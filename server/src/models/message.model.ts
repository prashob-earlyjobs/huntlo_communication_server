import mongoose from "mongoose";
import { MessageType, MessageVendor } from "../types/message.types";

export enum MessageStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  SENT = "sent",
  FAILED = "failed",
}

const messageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true,
    },
    vendor: {
      type: String,
      enum: [
        MessageVendor.GMAIL,
        MessageVendor.OUTLOOK,
        MessageVendor.HUNTLO,
        MessageVendor.SMTP,
        MessageVendor.META,
        MessageVendor.HUNAR,
        MessageVendor.ZYVKAY,
      ],
      required: true,
    },
    receiver: { type: String, required: true },
    message: String,
    details: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    idempotencyKey: String,
    jobId: String,
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.QUEUED,
    },
    attempts: { type: Number, default: 0 },
    lastError: String,
    providerMessageId: String,
    providerThreadId: String,
    conversationId:String
  },
  { timestamps: true }
);

if (mongoose.models.Message) {
  mongoose.deleteModel("Message");
}

export const Message = mongoose.model(
  "Message",
  messageSchema,
  "hcg_messages"
);
