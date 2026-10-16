import mongoose from "mongoose";
import { getOutlookAccessToken } from "../helpers/outlookToken";
import { OutlookConversation } from "../models/outlookConversation.model";

export const sendOutlookMessage = async (input: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string | null;
    threadId?: string | null;
    inReplyTo?: string | null;
    references?: string | null;
  }) =>{
    let accessToken = await getOutlookAccessToken(input.from);
   
    if (!accessToken) {
      throw new Error(
        `No Outlook token in userintegrations for ${input.from}`
      );
    }
    const graphBody = outlookHtmlBody(input.html, input.text);
    const replyTo = String(input.inReplyTo || "").trim();
    const url = replyTo
      ? `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(replyTo)}/reply`
      : "https://graph.microsoft.com/v1.0/me/sendMail";
    const payload = replyTo
      ? { message: { body: graphBody } }
      : {
          message: {
            subject: input.subject,
            body: graphBody,
            toRecipients: [{ emailAddress: { address: input.to } }],
          },
          saveToSentItems: true,
        };
    try {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if ((res.status === 401 || res.status === 403) && !res.ok) {
        accessToken = await getOutlookAccessToken(input.from, true);
        if (accessToken) {
          const retry = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          if (!retry.ok) {
            const data = await retry.json().catch(() => ({}));
            throw new Error(
              `Outlook send failed: ${data?.error?.message || retry.statusText}`
            );
          }
          console.log("mail send");
         
        }
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          `Outlook send failed: ${data?.error?.message || res.statusText}`
        );
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
}

async function outlookFetch(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchOutlookWebhookMessage(userId: string, messageId: string) {
  const row = await mongoose.connection.collection("userintegrations").findOne({
    provider: "outlook",
    providerAccountId: userId,
    status: { $in: ["connected", "needs_attention", "testing"] },
  });
  if (!row?.email) {
    throw new Error(`No Outlook integration for user ${userId}`);
  }

  let accessToken = await getOutlookAccessToken(String(row.email));
  if (!accessToken) {
    throw new Error(`No Outlook token in userintegrations for ${row.email}`);
  }

  const messageUrl =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}` +
    `/messages/${encodeURIComponent(messageId)}` +
    "?$select=conversationId,parentFolderId,subject,from,toRecipients,bodyPreview,body,uniqueBody";
  const inboxUrl =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}` +
    "/mailFolders/inbox?$select=id,displayName";

  let message = await outlookFetch(messageUrl, accessToken);
  if (message.res.status === 401 || message.res.status === 403) {
    accessToken = await getOutlookAccessToken(String(row.email), true);
    if (!accessToken) {
      throw new Error(`Outlook token refresh failed for ${row.email}`);
    }
    message = await outlookFetch(messageUrl, accessToken);
  }
  if (!message.res.ok) {
    throw new Error(message.data?.error?.message || "Outlook message fetch failed");
  }

  const inbox = await outlookFetch(inboxUrl, accessToken);
  if (!inbox.res.ok) {
    throw new Error(inbox.data?.error?.message || "Outlook inbox fetch failed");
  }

  return {
    email: row.email,
    isInbox: message.data.parentFolderId === inbox.data.id,
    conversationId: message.data.conversationId,
    parentFolderId: message.data.parentFolderId,
    inboxFolderId: inbox.data.id,
    subject: message.data.subject,
    from: message.data.from?.emailAddress?.address,
    to: (message.data.toRecipients || []).map(
      (recipient) => recipient?.emailAddress?.address
    ),
    bodyPreview: message.data.bodyPreview,
    text: outlookMessageText(message.data.uniqueBody?.content ? message.data.uniqueBody : message.data.body),
    html: String(message.data.body?.contentType || "").toLowerCase() === "html"
      ? message.data.body?.content
      : undefined,
  };
}

function outlookHtmlBody(html?: string, text?: string) {
  const raw = String(html || text || "");
  if (/<(p|br|div|html|body|ul|ol|li|strong|em|b|i|a|span|table|h[1-6])\b/i.test(raw)) {
    return { contentType: "HTML", content: raw };
  }
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const content = escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return { contentType: "HTML", content: content || "<p></p>" };
}

function outlookMessageText(body?: { contentType?: string; content?: string }) {
  const content = String(body?.content || "");
  if (String(body?.contentType || "").toLowerCase() !== "html") return content;
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainSubject(subject?: string) {
  return String(subject || "")
    .replace(/^((re|fw|fwd):\s*)+/gi, "")
    .trim()
    .toLowerCase();
}

export async function linkOutlookWebhookMessage(
  messageId: string,
  message: {
    email?: string;
    isInbox: boolean;
    conversationId?: string;
    subject?: string;
    from?: string;
    to?: string[];
    bodyPreview?: string;
    text?: string;
    html?: string;
  }
) {
  const email = String(message.email || "").trim().toLowerCase();
  const conversationId = String(message.conversationId || "").trim();
  let doc = conversationId
    ? await OutlookConversation.findOne({
        $or: [
          { threadId: conversationId },
          { outlookConversationId: conversationId },
        ],
      })
    : null;

  if (!doc && email) {
    const subject = plainSubject(message.subject);
    const party = message.isInbox
      ? [String(message.from || "").toLowerCase()]
      : (message.to || []).map((address) => String(address || "").toLowerCase());
    const recent = await OutlookConversation.find({ emailAddress: email })
      .sort({ updatedAt: -1 })
      .limit(30);
    doc =
      recent.find((row) => {
        if (plainSubject(row.subject) !== subject) return false;
        return (row.messages || []).some((item) =>
          party.includes(String(item.to || "").toLowerCase())
        );
      }) || null;
  }

  if (!doc) {
    console.log("outlook webhook not matched", {
      messageId,
      conversationId,
      subject: message.subject,
      isInbox: message.isInbox,
    });
    return null;
  }

  const update: Record<string, unknown> = {};
  if (conversationId) update.outlookConversationId = conversationId;

  const alreadyStored = (doc.messages || []).some(
    (item) => item.messageId === messageId
  );
  const placeholder = (doc.messages || []).find(
    (item) =>
      item.direction === "outbound" &&
      !String(item.messageId || "").startsWith("AAMk")
  );

  const query: Record<string, unknown> = { _id: doc._id };
  if (!alreadyStored && message.isInbox) {
    await OutlookConversation.updateOne(query, {
      $set: update,
      $push: {
        messages: {
          messageId,
          from: message.from,
          to: (message.to || []).filter(Boolean).join(", "),
          subject: message.subject,
          snippet: message.bodyPreview,
          body: message.text || message.bodyPreview,
          html: message.html,
          direction: "inbound",
          internalDate: String(Date.now()),
        },
      },
    });
  } else if (!alreadyStored && !message.isInbox && placeholder) {
    await OutlookConversation.updateOne(
      { _id: doc._id, "messages.messageId": placeholder.messageId },
      {
        $set: {
          ...update,
          "messages.$.messageId": messageId,
        },
      }
    );
  } else if (Object.keys(update).length) {
    await OutlookConversation.updateOne(query, { $set: update });
  }

  console.log("outlook webhook matched", {
    threadId: doc.threadId,
    isInbox: message.isInbox,
    messageId,
    subject: message.subject,
  });
  return OutlookConversation.findById(doc._id).lean();
}