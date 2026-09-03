import { Schema, model } from "mongoose";

export enum OverallAIStatus {
  AWAITING_REPLY = "awaiting_reply",
  INTERESTED = "interested",
  NOT_INTERESTED = "not_interested",
  IN_QUALIFICATION = "in_qualification",
  QUALIFIED = "qualified",
  NOT_QUALIFIED = "not_qualified",
  IN_SCREENING = "in_screening",
  SHORTLISTED = "shortlisted",
  REJECTED = "rejected",
}

const conversationMessageSchema = new Schema(
  {
    messageId: { type: String, required: true },
    from: String,
    to: String,
    subject: String,
    snippet: String,
    body: String,
    html: String,
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
    },
    internalDate: String,
  },
  { _id: false }
);

const gmailConversationSchema = new Schema(
  {
    threadId: {
      type: String,
      required: true,
      unique: true,
    },
    emailAddress: {
      type: String,
      lowercase: true,
      trim: true,
    },
    autoReply:{type:Boolean,default:false},
    campaignId: String,
    subject: String,
    prompt: String,
    overallAIStatus: {
      type: String,
      enum: Object.values(OverallAIStatus),
      default: OverallAIStatus.AWAITING_REPLY,
    },
    overallAIDescription: String,
    lastRepliedInboundId: String,
    questions: {
      type: [
        {
          id: String,
          question: String,
          asked: { type: Boolean, default: false },
          answer: String,
          status: {
            type: String,
            enum: ["unanswered", "passed", "failed"],
            default: "unanswered",
          },
          description: String,
        },
      ],
      default: [],
    },
    messages: {
      type: [conversationMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const GmailConversation = model(
  "GmailConversation",
  gmailConversationSchema,
  "hcg_gmail_conversations"
);
