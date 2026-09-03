import { Job } from "bullmq";
import { messageQueue } from "../queue/message.queue";
import { Message, MessageStatus } from "../models/message.model";

export type QueueJobStatus =
  | "waiting"
  | "active"
  | "delayed"
  | "completed"
  | "failed";

export type QueueJob = {
  id: string;
  name: string;
  vendor: string;
  receiver: string;
  status: QueueJobStatus;
  attemptsMade: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

const QUEUE_NAME = "messages";
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = 2000;
const JOB_LIMIT = 100;

function mapBullJob(job: Job, status: QueueJobStatus): QueueJob {
  const data = job.data || {};

  return {
    id: String(job.id),
    name: job.name,
    vendor: data.vendor || "",
    receiver: data.to || data.data?.[0]?.mobile_number || "",
    status,
    attemptsMade: job.attemptsMade || 0,
    maxAttempts: job.opts?.attempts || MAX_ATTEMPTS,
    lastError: job.failedReason || null,
    createdAt: new Date(job.timestamp).toISOString(),
    updatedAt: new Date(
      job.finishedOn || job.processedOn || job.timestamp
    ).toISOString(),
  };
}

function mapSentMessage(doc: any): QueueJob {
  return {
    id: String(doc.jobId || doc._id),
    name: doc.type,
    vendor: doc.vendor || "",
    receiver: doc.receiver || "",
    status: "completed",
    attemptsMade: doc.attempts || 0,
    maxAttempts: MAX_ATTEMPTS,
    lastError: doc.lastError || null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function getQueueStatus() {
  const [counts, waiting, active, delayed, failed, sentDocs, completedCount] =
    await Promise.all([
      messageQueue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "completed",
        "failed"
      ),
      messageQueue.getJobs(["waiting"], 0, JOB_LIMIT, false),
      messageQueue.getJobs(["active"], 0, JOB_LIMIT, false),
      messageQueue.getJobs(["delayed"], 0, JOB_LIMIT, false),
      messageQueue.getJobs(["failed"], 0, JOB_LIMIT, false),
      Message.find({ status: MessageStatus.SENT })
        .sort({ updatedAt: -1 })
        .limit(JOB_LIMIT)
        .lean(),
      Message.countDocuments({ status: MessageStatus.SENT }),
    ]);

  const jobs: QueueJob[] = [
    ...waiting.map((job) => mapBullJob(job, "waiting")),
    ...active.map((job) => mapBullJob(job, "active")),
    ...delayed.map((job) => mapBullJob(job, "delayed")),
    ...failed.map((job) => mapBullJob(job, "failed")),
  ];

  const seen = new Set(jobs.map((job) => job.id));

  for (const doc of sentDocs) {
    const mapped = mapSentMessage(doc);
    if (!seen.has(mapped.id)) {
      jobs.push(mapped);
      seen.add(mapped.id);
    }
  }

  jobs.sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );

  return {
    queue: QUEUE_NAME,
    maxAttempts: MAX_ATTEMPTS,
    backoffMs: BACKOFF_MS,
    counts: {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      delayed: counts.delayed || 0,
      completed: completedCount,
      failed: counts.failed || 0,
      total:
        (counts.waiting || 0) +
        (counts.active || 0) +
        (counts.delayed || 0) +
        completedCount +
        (counts.failed || 0),
    },
    retries: {
      retrying: counts.delayed || 0,
      retried: jobs.filter((job) => job.attemptsMade > 1).length,
      extraAttempts: jobs.reduce(
        (sum, job) => sum + Math.max(0, job.attemptsMade - 1),
        0
      ),
      maxAttempts: MAX_ATTEMPTS,
    },
    jobs,
    updatedAt: new Date().toISOString(),
  };
}
