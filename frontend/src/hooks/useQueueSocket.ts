import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { QueueJob, QueueJobStatus } from '../data/queueMock'

export type QueueConnection = 'connecting' | 'live' | 'reconnecting' | 'offline'

export type QueueCounts = {
  waiting: number
  active: number
  delayed: number
  completed: number
  failed: number
  total: number
}

export type QueueRetries = {
  retrying: number
  retried: number
  extraAttempts: number
  maxAttempts: number
}

export type QueueSnapshot = {
  queue: string
  maxAttempts: number
  backoffMs: number
  counts: QueueCounts
  retries: QueueRetries
  jobs: QueueJob[]
  updatedAt: string
}

const emptySnapshot: QueueSnapshot = {
  queue: 'messages',
  maxAttempts: 4,
  backoffMs: 2000,
  counts: {
    waiting: 0,
    active: 0,
    delayed: 0,
    completed: 0,
    failed: 0,
    total: 0,
  },
  retries: {
    retrying: 0,
    retried: 0,
    extraAttempts: 0,
    maxAttempts: 4,
  },
  jobs: [],
  updatedAt: '',
}

export type { QueueJobStatus }

export function useQueueSocket() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(emptySnapshot)
  const [connection, setConnection] = useState<QueueConnection>('connecting')

  useEffect(() => {
    const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 4000,
      randomizationFactor: 0.5,
      timeout: 8000,
    })

    socket.on('connect', () => setConnection('live'))
    socket.on('disconnect', (reason) => {
      setConnection(reason === 'io client disconnect' ? 'offline' : 'reconnecting')
    })
    socket.io.on('reconnect_attempt', () => setConnection('reconnecting'))
    socket.io.on('reconnect_failed', () => setConnection('offline'))
    socket.on('connect_error', () => {
      setConnection(socket.active ? 'reconnecting' : 'offline')
    })
    socket.on('queue:status', (next: QueueSnapshot) => {
      setSnapshot(next)
      setConnection('live')
    })

    return () => {
      socket.removeAllListeners()
      socket.close()
    }
  }, [])

  return { ...snapshot, connection }
}
