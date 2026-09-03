import { useEffect, useRef, useState } from 'react'
import { useQueueSocket, type QueueCounts } from '../hooks/useQueueSocket'

const HOLD_MS = 3000
const countKeys = ['waiting', 'active', 'delayed', 'completed', 'failed'] as const

function useHeldCounts(counts: QueueCounts): QueueCounts {
  const [held, setHeld] = useState(counts)
  const heldRef = useRef(counts)
  const pending = useRef<Partial<Record<(typeof countKeys)[number], number>>>({})
  const timers = useRef<Partial<Record<(typeof countKeys)[number], number>>>({})

  useEffect(() => {
    heldRef.current = held
  }, [held])

  useEffect(() => {
    for (const key of countKeys) {
      const next = counts[key]
      const shown = heldRef.current[key]

      if (next >= shown) {
        if (timers.current[key]) {
          window.clearTimeout(timers.current[key])
          delete timers.current[key]
        }
        delete pending.current[key]
        if (next !== shown) {
          setHeld((current) => ({ ...current, [key]: next }))
        }
        continue
      }

      pending.current[key] = next
      if (timers.current[key]) continue
      timers.current[key] = window.setTimeout(() => {
        const delayed = pending.current[key]
        delete pending.current[key]
        delete timers.current[key]
        if (typeof delayed === 'number') {
          setHeld((current) => ({ ...current, [key]: delayed }))
        }
      }, HOLD_MS)
    }

    setHeld((current) =>
      current.total === counts.total ? current : { ...current, total: counts.total }
    )
  }, [counts])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(timers.current)) {
        if (timer) window.clearTimeout(timer)
      }
    }
  }, [])

  return held
}

const connectionLabel = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
}

function formatTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Home() {
  const { counts, retries, connection, updatedAt } = useQueueSocket()
  const shownCounts = useHeldCounts(counts)

  const cards = [
    { key: 'waiting', label: 'Waiting', value: shownCounts.waiting },
    { key: 'active', label: 'Active', value: shownCounts.active },
    { key: 'delayed', label: 'Retrying', value: shownCounts.delayed },
    { key: 'completed', label: 'Completed', value: shownCounts.completed },
    { key: 'failed', label: 'Failed', value: shownCounts.failed },
  ] as const

  return (
    <main className="home">
      <header className="queue-header">
        <div>
          <h1>Dashboard</h1>
          <p className="lede">Live message queue.</p>
        </div>
        <p className={`queue-live is-${connection}`}>
          {connectionLabel[connection]}
          {updatedAt ? ` · ${formatTime(updatedAt)}` : ''}
        </p>
      </header>

      <section className="queue-cards" aria-label="Queue counts">
        {cards.map((card) => (
          <div key={card.key} className="queue-card">
            <span className="queue-card-label">{card.label}</span>
            <span className="queue-card-value">{card.value}</span>
          </div>
        ))}
      </section>

      <section className="queue-retries" aria-label="Retry summary">
        <p>
          <strong>{retries.retrying}</strong> currently retrying
        </p>
        <p>
          <strong>{retries.retried}</strong> jobs have been retried
        </p>
        <p>
          <strong>{retries.extraAttempts}</strong> extra attempts so far
        </p>
      </section>
    </main>
  )
}
