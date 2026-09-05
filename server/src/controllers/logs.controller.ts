import { Request, Response } from "express";
import { GmailConversation } from "../models/gmailConversation.model";
import { WhatsappConversation } from "../models/whatsappConversation.model";
import { HunarCommunication } from "../models/hunarCommunication.model";
import { ZyvkaCommunication } from "../models/zyvkaCommunication.model";
import { sendError, sendSuccess } from "../helpers/requestHandler";

const CHANNELS = ["gmail", "whatsapp", "hunar", "zyvkay"] as const;
type Channel = (typeof CHANNELS)[number];

const COLLECTIONS: Record<Channel, string> = {
  gmail: "hcg_gmail_conversations",
  whatsapp: "hcg_whatsapp_conversations",
  hunar: "hcg_hunar_communications",
  zyvkay: "hcg_zyvkay_communications",
};

const MODELS = {
  gmail: GmailConversation,
  whatsapp: WhatsappConversation,
  hunar: HunarCommunication,
  zyvkay: ZyvkaCommunication,
};

function asText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj.status || obj.call_status || obj.summary || obj.message || "");
  }
  return "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mixedToString(field: string) {
  return {
    $let: {
      vars: { v: `$${field}` },
      in: {
        $switch: {
          branches: [
            {
              case: { $in: [{ $type: "$$v" }, ["missing", "null"]] },
              then: "",
            },
            { case: { $eq: [{ $type: "$$v" }, "string"] }, then: "$$v" },
            {
              case: { $eq: [{ $type: "$$v" }, "object"] },
              then: {
                $ifNull: [
                  "$$v.status",
                  {
                    $ifNull: [
                      "$$v.call_status",
                      { $ifNull: ["$$v.summary", { $ifNull: ["$$v.message", ""] }] },
                    ],
                  },
                ],
              },
            },
          ],
          default: { $toString: "$$v" },
        },
      },
    },
  };
}

const lastMessagePreview = {
  $let: {
    vars: { last: { $arrayElemAt: ["$messages", -1] } },
    in: {
      $ifNull: [
        "$$last.snippet",
        { $ifNull: ["$$last.body", { $ifNull: ["$overallAIDescription", ""] }] },
      ],
    },
  },
};

const lastMessageDirection = {
  $let: {
    vars: { last: { $arrayElemAt: ["$messages", -1] } },
    in: { $ifNull: ["$$last.direction", ""] },
  },
};

const gmailParty = {
  $let: {
    vars: { last: { $arrayElemAt: ["$messages", -1] } },
    in: {
      $ifNull: [
        {
          $cond: [
            { $eq: ["$$last.direction", "outbound"] },
            { $ifNull: ["$$last.to", "$$last.from"] },
            { $ifNull: ["$$last.from", "$$last.to"] },
          ],
        },
        { $ifNull: ["$emailAddress", ""] },
      ],
    },
  },
};

const projections: Record<Channel, Record<string, unknown>> = {
  gmail: {
    _id: 0,
    id: { $toString: "$_id" },
    channel: { $literal: "gmail" },
    party: gmailParty,
    title: { $ifNull: ["$subject", "$threadId"] },
    status: { $ifNull: ["$overallAIStatus", ""] },
    preview: lastMessagePreview,
    direction: lastMessageDirection,
    threadId: "$threadId",
    autoReply: "$autoReply",
    createdAt: "$createdAt",
    updatedAt: "$updatedAt",
  },
  whatsapp: {
    _id: 0,
    id: { $toString: "$_id" },
    channel: { $literal: "whatsapp" },
    party: { $ifNull: ["$phone", ""] },
    title: { $ifNull: ["$threadId", "$phone"] },
    status: { $ifNull: ["$overallAIStatus", ""] },
    preview: lastMessagePreview,
    direction: lastMessageDirection,
    threadId: "$threadId",
    autoReply: "$autoReply",
    messageCount: { $size: { $ifNull: ["$messages", []] } },
    messages: {
      $map: {
        input: { $ifNull: ["$messages", []] },
        as: "m",
        in: {
          messageId: "$$m.messageId",
          from: "$$m.from",
          to: "$$m.to",
          body: { $ifNull: ["$$m.body", { $ifNull: ["$$m.snippet", ""] }] },
          template: "$$m.template",
          direction: "$$m.direction",
          internalDate: "$$m.internalDate",
        },
      },
    },
    createdAt: "$createdAt",
    updatedAt: "$updatedAt",
  },
  hunar: {
    _id: 0,
    id: { $toString: "$_id" },
    channel: { $literal: "hunar" },
    party: { $ifNull: ["$mobileNumber", ""] },
    title: { $ifNull: ["$campaignId", "$callId"] },
    status: mixedToString("call_status"),
    preview: mixedToString("call_summary"),
    direction: { $literal: "" },
    threadId: { $ifNull: ["$callId", ""] },
    agentId: "$agentId",
    campaignId: "$campaignId",
    createdAt: "$createdAt",
    updatedAt: "$updatedAt",
  },
  zyvkay: {
    _id: 0,
    id: { $toString: "$_id" },
    channel: { $literal: "zyvkay" },
    party: { $ifNull: ["$mobileNumber", ""] },
    title: { $ifNull: ["$campaignId", "$callId"] },
    status: mixedToString("call_status"),
    preview: mixedToString("call_summary"),
    direction: { $literal: "" },
    threadId: { $ifNull: ["$callId", ""] },
    campaignId: "$campaignId",
    createdAt: "$createdAt",
    updatedAt: "$updatedAt",
  },
};

function sourceStages(channel: Channel) {
  return [{ $project: projections[channel] }];
}

export async function getLogs(req: Request, res: Response) {
  try {
    const channelParam = String(req.query.channel || "all").toLowerCase();
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    if (channelParam !== "all" && !CHANNELS.includes(channelParam as Channel)) {
      return sendError(res, 400, "channel must be all, gmail, whatsapp, hunar, or zyvkay");
    }

    const selected: Channel[] =
      channelParam === "all" ? [...CHANNELS] : [channelParam as Channel];

    const [first, ...rest] = selected;
    const pipeline: any[] = [...sourceStages(first)];

    for (const channel of rest) {
      pipeline.push({
        $unionWith: {
          coll: COLLECTIONS[channel],
          pipeline: sourceStages(channel),
        },
      });
    }

    const filters: Record<string, unknown>[] = [];

    if (q) {
      const regex = { $regex: escapeRegex(q), $options: "i" };
      filters.push({
        $or: [
          { party: regex },
          { title: regex },
          { preview: regex },
          { status: regex },
          { threadId: regex },
          { agentId: regex },
          { campaignId: regex },
          { "messages.body": regex },
          { "messages.snippet": regex },
        ],
      });
    }

    if (status) {
      filters.push({ status });
    }

    if (filters.length) {
      pipeline.push({ $match: filters.length === 1 ? filters[0] : { $and: filters } });
    }

    pipeline.push({ $sort: { updatedAt: -1 } });
    pipeline.push({
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        meta: [{ $count: "total" }],
      },
    });

    const [result] = await MODELS[first].aggregate(pipeline);
    const items = (result?.items || []).map((item) => ({
      ...item,
      status: asText(item.status),
      preview: asText(item.preview),
    }));
    const total = result?.meta?.[0]?.total || 0;

    return sendSuccess(res, 200, {
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Internal server error");
  }
}
