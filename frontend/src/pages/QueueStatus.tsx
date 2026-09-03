import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueueSocket, type QueueJobStatus } from '../hooks/useQueueSocket'

const statusFilters: Array<{ value: 'all' | QueueJobStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'active', label: 'Active' },
  { value: 'delayed', label: 'Retrying' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

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

export default function QueueStatus() {
  const [filter, setFilter] = useState<'all' | QueueJobStatus>('all')
  const {
    queue,
    maxAttempts,
    backoffMs,
    counts,
    retries,
    jobs,
    updatedAt,
    connection,
  } = useQueueSocket()

  const visibleJobs = useMemo(() => {
    if (filter === 'all') return jobs
    return jobs.filter((job) => job.status === filter)
  }, [filter, jobs])

  const cards = [
    { key: 'waiting', label: 'Waiting', value: counts.waiting },
    { key: 'active', label: 'Active', value: counts.active },
    { key: 'delayed', label: 'Retrying', value: counts.delayed },
    { key: 'completed', label: 'Completed', value: counts.completed },
    { key: 'failed', label: 'Failed', value: counts.failed },
  ] as const

  return (
    <main className="queue">
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <header className="queue-header">
        <div>
          <p className="eyebrow">BullMQ · {queue}</p>
          <h1>Queue status</h1>
          <p className="lede">
            {counts.total} jobs · {maxAttempts} max attempts · exponential backoff
            ({backoffMs / 1000}s)
          </p>
        </div>
        <p className={`queue-live is-${connection}`}>
          {connectionLabel[connection]}
          {updatedAt ? ` · ${formatTime(updatedAt)}` : ''}
        </p>
      </header>

      <section className="queue-cards" aria-label="Queue counts">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`queue-card${filter === card.key ? ' is-selected' : ''}`}
            onClick={() =>
              setFilter((current) => (current === card.key ? 'all' : card.key))
            }
          >
            <span className="queue-card-label">{card.label}</span>
            <span className="queue-card-value">{card.value}</span>
          </button>
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

      <div className="queue-toolbar">
        <div className="queue-filters" role="tablist" aria-label="Filter jobs">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className={`queue-filter${filter === item.value ? ' is-active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="queue-count">{visibleJobs.length} shown</p>
      </div>

      <div className="queue-table-wrap">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Channel</th>
              <th>Receiver</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="queue-empty">
                  {connection === 'live' ? 'No jobs in this view.' : 'Waiting for queue data…'}
                </td>
              </tr>
            ) : (
              visibleJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <span className="queue-job-id">#{job.id}</span>
                  </td>
                  <td>
                    <span className="queue-channel">{job.name}</span>
                    <span className="queue-vendor">{job.vendor}</span>
                  </td>
                  <td>{job.receiver || '—'}</td>
                  <td>
                    <span className={`queue-status status-${job.status}`}>
                      {job.status}
                    </span>
                    {job.lastError ? (
                      <span className="queue-error">{job.lastError}</span>
                    ) : null}
                  </td>
                  <td>
                    {job.attemptsMade}/{job.maxAttempts}
                  </td>
                  <td>{formatTime(job.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
