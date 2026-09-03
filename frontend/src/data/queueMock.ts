export type QueueJobName = 'email' | 'whatsapp' | 'call'
export type QueueJobStatus = 'waiting' | 'active' | 'delayed' | 'completed' | 'failed'

export type QueueJob = {
  id: string
  name: QueueJobName
  vendor: string
  receiver: string
  status: QueueJobStatus
  attemptsMade: number
  maxAttempts: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export const QUEUE_NAME = 'messages'
export const MAX_ATTEMPTS = 4
export const BACKOFF_MS = 2000

export const mockQueueJobs: QueueJob[] = [
  {
    id: '10241',
    name: 'email',
    vendor: 'gmail',
    receiver: 'priya.sharma@example.com',
    status: 'waiting',
    attemptsMade: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T07:12:04.000Z',
    updatedAt: '2026-09-03T07:12:04.000Z',
  },
  {
    id: '10242',
    name: 'whatsapp',
    vendor: 'huntlo',
    receiver: '+919876543210',
    status: 'waiting',
    attemptsMade: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T07:13:18.000Z',
    updatedAt: '2026-09-03T07:13:18.000Z',
  },
  {
    id: '10238',
    name: 'call',
    vendor: 'hunar',
    receiver: '+918800112233',
    status: 'waiting',
    attemptsMade: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T07:08:41.000Z',
    updatedAt: '2026-09-03T07:08:41.000Z',
  },
  {
    id: '10229',
    name: 'email',
    vendor: 'gmail',
    receiver: 'arjun.mehta@example.com',
    status: 'active',
    attemptsMade: 1,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T07:05:02.000Z',
    updatedAt: '2026-09-03T07:14:11.000Z',
  },
  {
    id: '10231',
    name: 'whatsapp',
    vendor: 'huntlo',
    receiver: '+917700998877',
    status: 'delayed',
    attemptsMade: 2,
    maxAttempts: MAX_ATTEMPTS,
    lastError: 'WhatsApp API 429: rate limit exceeded',
    createdAt: '2026-09-03T06:51:33.000Z',
    updatedAt: '2026-09-03T07:13:55.000Z',
  },
  {
    id: '10219',
    name: 'email',
    vendor: 'gmail',
    receiver: 'neha.kapoor@example.com',
    status: 'delayed',
    attemptsMade: 1,
    maxAttempts: MAX_ATTEMPTS,
    lastError: 'SMTP connection timed out',
    createdAt: '2026-09-03T06:44:09.000Z',
    updatedAt: '2026-09-03T07:12:40.000Z',
  },
  {
    id: '10207',
    name: 'call',
    vendor: 'hunar',
    receiver: '+919988776655',
    status: 'delayed',
    attemptsMade: 3,
    maxAttempts: MAX_ATTEMPTS,
    lastError: 'Hunar campaign rejected: agent busy',
    createdAt: '2026-09-03T06:21:14.000Z',
    updatedAt: '2026-09-03T07:11:02.000Z',
  },
  {
    id: '10188',
    name: 'email',
    vendor: 'gmail',
    receiver: 'rahul.verma@example.com',
    status: 'completed',
    attemptsMade: 1,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T06:02:51.000Z',
    updatedAt: '2026-09-03T06:03:08.000Z',
  },
  {
    id: '10190',
    name: 'whatsapp',
    vendor: 'huntlo',
    receiver: '+916200334455',
    status: 'completed',
    attemptsMade: 1,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T06:10:22.000Z',
    updatedAt: '2026-09-03T06:10:41.000Z',
  },
  {
    id: '10174',
    name: 'call',
    vendor: 'hunar',
    receiver: '+918765432109',
    status: 'completed',
    attemptsMade: 2,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T05:41:07.000Z',
    updatedAt: '2026-09-03T05:44:19.000Z',
  },
  {
    id: '10161',
    name: 'email',
    vendor: 'gmail',
    receiver: 'anita.desai@example.com',
    status: 'completed',
    attemptsMade: 1,
    maxAttempts: MAX_ATTEMPTS,
    lastError: null,
    createdAt: '2026-09-03T05:18:33.000Z',
    updatedAt: '2026-09-03T05:18:47.000Z',
  },
  {
    id: '10148',
    name: 'whatsapp',
    vendor: 'huntlo',
    receiver: '+919111223344',
    status: 'failed',
    attemptsMade: 4,
    maxAttempts: MAX_ATTEMPTS,
    lastError: 'Invalid recipient: number not on WhatsApp',
    createdAt: '2026-09-03T04:52:16.000Z',
    updatedAt: '2026-09-03T05:01:03.000Z',
  },
  {
    id: '10122',
    name: 'email',
    vendor: 'gmail',
    receiver: 'kiran.joshi@example.com',
    status: 'failed',
    attemptsMade: 4,
    maxAttempts: MAX_ATTEMPTS,
    lastError: 'Gmail 401: access token expired',
    createdAt: '2026-09-03T04:11:48.000Z',
    updatedAt: '2026-09-03T04:20:12.000Z',
  },
]

export type QueueCounts = {
  waiting: number
  active: number
  delayed: number
  completed: number
  failed: number
  total: number
}

export function getQueueCounts(jobs: QueueJob[]): QueueCounts {
  const counts: QueueCounts = {
    waiting: 0,
    active: 0,
    delayed: 0,
    completed: 0,
    failed: 0,
    total: jobs.length,
  }

  for (const job of jobs) {
    counts[job.status] += 1
  }

  return counts
}

export function getRetryStats(jobs: QueueJob[]) {
  const retrying = jobs.filter((job) => job.status === 'delayed').length
  const retried = jobs.filter((job) => job.attemptsMade > 1).length
  const extraAttempts = jobs.reduce(
    (sum, job) => sum + Math.max(0, job.attemptsMade - 1),
    0
  )

  return { retrying, retried, extraAttempts, maxAttempts: MAX_ATTEMPTS }
}
