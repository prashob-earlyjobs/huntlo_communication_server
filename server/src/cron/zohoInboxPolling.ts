import { schedule } from "node-cron";
import axios from "axios";
import {
  OverallAIStatus,
  ZohoConversation,
} from "../models/zohoConversation.model";
import { getZohoAccessToken } from "../helpers/zohoToken";
import { generateGeminiContent } from "../helpers/gamini";
import { getZohoDcConfig, sendZohoMessage } from "../services/zoho.service";
import { parseGeminiJson, statusPrompt } from "../controllers/webhook.controller";

const TERMINAL_AI_STATUSES = [
  OverallAIStatus.NOT_INTERESTED,
  OverallAIStatus.NOT_QUALIFIED,
  OverallAIStatus.QUALIFIED,
  OverallAIStatus.IN_SCREENING,
  OverallAIStatus.SHORTLISTED,
  OverallAIStatus.REJECTED,
];

type ZohoFolder = { folderId?: string | number; path?: string };
type ZohoMailMessage = {
  messageId?: string | number;
  threadId?: string | number;
  fromAddress?: string;
  toAddress?: string;
  subject?: string;
  summary?: string;
  html?: string;
  receivedTime?: string | number;
  sentDateInGMT?: string | number;
};

function normalizeEmail(value?: string) {
  const raw = String(value || "").trim().toLowerCase();
  const angled = raw.match(/<([^>]+)>/);
  return (angled?.[1] || raw).replace(/[<>]/g, "").trim();
}

function zohoHeaders(token: string) {
  return { Authorization: `Zoho-oauthtoken ${token}` };
}

function mailApiBase(dataCenter?: string) {
  return `https://${getZohoDcConfig(dataCenter).mailApiHost}`;
}

async function zohoGet<T>(url: string, token: string): Promise<T> {
  try {
    const resp = await axios.get<T>(url, { headers: zohoHeaders(token) });
    return resp.data;
  } catch (error) {
    const err = error as {
      message?: string;
      response?: { status?: number; data?: unknown };
    };
    const detail =
      typeof err.response?.data === "object"
        ? JSON.stringify(err.response.data)
        : String(err.response?.data || err.message || "Zoho request failed");
    throw new Error(`Zoho ${err.response?.status || ""} ${detail}`.trim());
  }
}

async function getInboxFolderId(input: {
  token: string;
  accountId: string;
  dataCenter?: string;
  cache: Map<string, string>;
}) {
  const cacheKey = `${input.dataCenter || "com"}:${input.accountId}`;
  const cached = input.cache.get(cacheKey);
  if (cached) return cached;

  const data = await zohoGet<{
    status?: { code?: number };
    data?: ZohoFolder[];
  }>(
    `${mailApiBase(input.dataCenter)}/api/accounts/${encodeURIComponent(input.accountId)}/folders`,
    input.token
  );

  if (data?.status?.code && data.status.code !== 200) {
    throw new Error(`Zoho folders failed (${data.status.code})`);
  }

  const inbox = (data?.data || []).find(
    (folder) => String(folder.path || "").toLowerCase() === "/inbox"
  );
  const folderId = String(inbox?.folderId || "");
  if (folderId) input.cache.set(cacheKey, folderId);
  return folderId;
}

export function startZohoInboxPolling() {
  let isRunning = false;

  schedule("* * * * *", async () => {
    console.log("zoho poll runnning")
    if (isRunning) return;
    isRunning = true;

    try {
      const conversations = await ZohoConversation.find({
        autoReply: true,
        overallAIStatus: { $nin: TERMINAL_AI_STATUSES },
      }).lean();

      const tokenCache = new Map<string, string | null>();
      const inboxFolderCache = new Map<string, string>();

      for (const conversation of conversations) {
        try {
          const email = normalizeEmail(conversation.emailAddress);
          const accountId = String(conversation.accountId || "");
          // Zoho API needs Zoho thread/message id — never HCG conversation UUID
          const zohoThreadId = String(
            conversation.providerThreadId ||
              conversation.messages?.find((m) => m.direction === "outbound")
                ?.messageId ||
              conversation.messages?.[0]?.messageId ||
              ""
          );
          if (!email || !accountId || !zohoThreadId) continue;
          if (!/^\d+$/.test(zohoThreadId)) {
            console.error(
              `Zoho inbox poll skipped ${conversation.threadId}: invalid zohoThreadId=${zohoThreadId}`
            );
            continue;
          }

          if (!tokenCache.has(email)) {
            tokenCache.set(email, await getZohoAccessToken(email));
          }
          const token = tokenCache.get(email);
          if (!token) continue;

          const folderId = await getInboxFolderId({
            token,
            accountId,
            dataCenter: conversation.dataCenter,
            cache: inboxFolderCache,
          });
          if (!folderId) continue;

          const threadResp = await zohoGet<{
            status?: { code?: number };
            data?: ZohoMailMessage[];
          }>(
            `${mailApiBase(conversation.dataCenter)}/api/accounts/${encodeURIComponent(accountId)}/messages/view?folderId=${encodeURIComponent(folderId)}&threadId=${encodeURIComponent(zohoThreadId)}`,
            token
          );

          if (threadResp?.status?.code && threadResp.status.code !== 200) {
            continue;
          }

          const remoteMessages = Array.isArray(threadResp?.data)
            ? threadResp.data
            : [];

          const remoteThreadId = String(
            remoteMessages.find((message) => message.threadId)?.threadId || ""
          );
          if (
            remoteThreadId &&
            remoteThreadId !== String(conversation.providerThreadId || "")
          ) {
            await ZohoConversation.updateOne(
              { _id: conversation._id },
              { $set: { providerThreadId: remoteThreadId } }
            );
          }
          const knownIds = new Set(
            (conversation.messages || [])
              .map((message) => String(message.messageId || ""))
              .filter(Boolean)
          );

          const newInbound = remoteMessages
            .filter((message) => {
              const messageId = String(message.messageId || "");
              if (!messageId || knownIds.has(messageId)) return false;
              return (
                normalizeEmail(message.fromAddress) &&
                normalizeEmail(message.fromAddress) !== email
              );
            })
            .sort(
              (a, b) =>
                Number(a.receivedTime || a.sentDateInGMT || 0) -
                Number(b.receivedTime || b.sentDateInGMT || 0)
            );

          if (!newInbound.length) continue;

          const formattedMessages = newInbound.map((message) => ({
            messageId: String(message.messageId),
            from: normalizeEmail(message.fromAddress),
            to: normalizeEmail(message.toAddress) || email,
            subject: message.subject,
            snippet: message.summary,
            body: message.summary,
            html: message.html,
            direction: "inbound" as const,
            internalDate: String(
              message.receivedTime || message.sentDateInGMT || Date.now()
            ),
          }));

          for (const message of formattedMessages) {
            await ZohoConversation.updateOne(
              {
                _id: conversation._id,
                "messages.messageId": { $ne: message.messageId },
              },
              { $push: { messages: message } }
            );
          }

          const latestInbound = formattedMessages[formattedMessages.length - 1];
          const claimed = await ZohoConversation.findOneAndUpdate(
            {
              _id: conversation._id,
              autoReply: true,
              lastRepliedInboundId: { $ne: latestInbound.messageId },
              overallAIStatus: { $nin: TERMINAL_AI_STATUSES },
            },
            { $set: { lastRepliedInboundId: latestInbound.messageId } },
            { new: true }
          );
          if (!claimed) continue;

          const inboundIds = new Set(
            formattedMessages.map((message) => message.messageId)
          );
          const previousMessages = [
            ...(claimed.messages || []).filter(
              (message) => !inboundIds.has(String(message.messageId || ""))
            ),
            ...formattedMessages,
          ].map((message) => ({
            from: message.from,
            to: message.to,
            subject: message.subject,
            body: message.body,
            html: message.html,
            direction: message.direction,
          }));

          const prompt =
            (claimed.prompt || "") +
            "\n\n" +
            JSON.stringify(previousMessages, null, 2);
          const generatedReply = await generateGeminiContent(prompt);
          if (!generatedReply?.trim()) continue;

          const inboundSubject =
            latestInbound.subject || claimed.subject || "";
          const replySubject = /^re:/i.test(inboundSubject)
            ? inboundSubject
            : `Re: ${inboundSubject}`;
          const toAddress = String(latestInbound.from || "").trim();
          if (!toAddress) continue;

          const sent = await sendZohoMessage({
            accessToken: token,
            accountId,
            dataCenter: claimed.dataCenter || conversation.dataCenter || "in",
            from: email,
            to: toAddress,
            subject: replySubject,
            text: generatedReply,
            inReplyToMessageId: latestInbound.messageId,
          });

          const promptWithReply =
            (claimed.prompt || "") +
            "\n\n" +
            JSON.stringify(
              [
                ...previousMessages,
                {
                  from: email,
                  to: toAddress,
                  subject: replySubject,
                  body: generatedReply,
                  direction: "outbound",
                },
              ],
              null,
              2
            );

          await ZohoConversation.updateOne(
            { _id: conversation._id },
            { $set: { prompt: promptWithReply } }
          );


          const actualPrompt = statusPrompt.replace("{{prompt}}", promptWithReply);
          const overallAIStatus = parseGeminiJson(
            await generateGeminiContent(actualPrompt)
          );

          await ZohoConversation.updateOne(
            { _id: conversation._id },
            {
              $set: {
                overallAIDescription: overallAIStatus?.overallAIDescription,
                overallAIStatus: overallAIStatus?.overallAIStatus,
                questions: overallAIStatus?.questions || [],
                ...(TERMINAL_AI_STATUSES.includes(overallAIStatus?.overallAIStatus)
                  ? { autoReply: false }
                  : {}),
              },
            }
          );

          if (sent?.messageId) {
            await ZohoConversation.updateOne(
              {
                _id: conversation._id,
                "messages.messageId": { $ne: sent.messageId },
              },
              {
                $push: {
                  messages: {
                    messageId: sent.messageId,
                    from: email,
                    to: toAddress,
                    subject: replySubject,
                    snippet: generatedReply,
                    body: generatedReply,
                    direction: "outbound",
                    internalDate: String(Date.now()),
                  },
                },
              }
            );
          }
        } catch (error) {
          console.error(
            `Zoho inbox poll failed for thread ${conversation.threadId}:`,
            (error as Error).message
          );
        }
      }
    } catch (error) {
      console.error("Zoho inbox polling failed:", (error as Error).message);
    } finally {
      isRunning = false;
    }
  });

  console.log("\x1b[32m✔\x1b[0m Zoho inbox polling cron started");
}
