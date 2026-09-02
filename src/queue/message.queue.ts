import dotenv from "dotenv";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { sendEmailMessage, sendWhatsappMessage } from "../services/message.service";
import { Message, MessageStatus } from "../models/message.model";
import { MessageVendor } from "../types/message.types";
import {v4 as uuidv4} from 'uuid';
import { GmailConversation } from "../models/gmailConversation.model";

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

export const messageQueue = new Queue("messages", { connection });

export async function connectRedis() {
  await messageQueue.waitUntilReady();
  console.log("\x1b[32m✔\x1b[0m Redis connected");
}

export async function enqueueMessage(payload) {
  const {
    accessToken,
    refreshToken,
    smtp,
    autoReply,
    ...safePayload
  } = payload;
  let conversationId :string;
  if(autoReply){
    conversationId = uuidv4()
  }

  const smtpPassword = smtp?.password;
  const safeSmtp = smtp
    ? { ...smtp, password: undefined }
    : undefined;

  const doc = await Message.create({
    type: payload.type,
    vendor: payload.vendor,
    receiver: payload.to,
    message: payload.body,
    details: {
      subject: payload.subject,
      html: payload.html,
      from: payload.from || smtp?.from,
      smtp: safeSmtp,
    },
    conversationId,
    metadata: payload.metadata,
    idempotencyKey: payload.idempotencyKey,
    status: MessageStatus.QUEUED,
  });

  const job = await messageQueue.add(
    payload.type,
    {
      dbId: String(doc._id),
      ...safePayload,
      conversationId,
      smtp: smtp ? { ...smtp, password: smtpPassword } : undefined,
      accessToken,
      refreshToken,
      autoReply
    },
    {
      attempts: 4,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  doc.jobId = job.id;
  await doc.save();

  return {
    queued: true,
    id: doc._id,
    jobId: job.id,
    status: doc.status,
    conversationId
  };
}

export function startMessageWorker() {
  const worker = new Worker(
    "messages",
    async (job) => {
      await Message.findByIdAndUpdate(job.data.dbId, {
        status: MessageStatus.PROCESSING,
        attempts: job.attemptsMade + 1,
      });

      if (job.name === "email") {
        return sendEmailMessage(job.data);
      }

      if(job.name === "whatsapp") {
        return sendWhatsappMessage(job.data);
      }

      throw new Error(`${job.name} sending is not implemented yet`);
    },
    { connection }
  );

  worker.on("completed", async (job, result) => {
    await Message.findByIdAndUpdate(job.data.dbId, {
      status: MessageStatus.SENT,
      providerMessageId: result?.messageId,
      providerThreadId: result?.threadId,
      lastError: null,
    });


    if (job.data.vendor === MessageVendor.GMAIL && result?.threadId) {
      await GmailConversation.updateOne(
        { threadId: result.threadId },
        {
          $setOnInsert: {
            threadId: result.threadId,
            emailAddress: job.data.from,
            subject: job.data.subject,
            autoReply:job.data.autoReply,
            prompt: job.data.prompt,
            overallAIStatus:"Awaiting reply",
            overallAIDescription:"Outreach sent, no candidate reply yet"
          },
          $push: {
            messages: {
              messageId: result.messageId,
              from: job.data.from,
              to: job.data.to,
              subject: job.data.subject,
              snippet: job.data.body,
              body: job.data.body,
              html: job.data.html,
              direction: "outbound",
              internalDate: String(Date.now()),
            },
          },
        },
        { upsert: true }
      );
    }

    console.log(`Job ${job.id} sent`);
  });

  worker.on("failed", async (job, err) => {
    const failed = (job?.attemptsMade || 0) >= 4;
    await Message.findByIdAndUpdate(job?.data.dbId, {
      status: failed ? MessageStatus.FAILED : MessageStatus.QUEUED,
      attempts: job?.attemptsMade,
      lastError: err.message,
    });
    console.error(`Job ${job?.id} failed (${job?.attemptsMade}/4):`, err.message);
  });

  return worker;
}
