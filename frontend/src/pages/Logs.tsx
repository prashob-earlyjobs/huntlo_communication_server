import { useEffect, useRef, useState, type MouseEvent } from 'react'

type ChannelFilter = 'all' | 'gmail' | 'whatsapp' | 'hunar'

type ThreadMessage = {
  messageId?: string
  from?: string
  to?: string
  body?: string
  template?: string
  direction?: string
  internalDate?: string
}

type LogItem = {
  id: string
  channel: 'gmail' | 'whatsapp' | 'hunar'
  party: string
  status: string
  preview: string
  direction?: string
  threadId?: string
  updatedAt: string
  messageCount?: number
  messages?: ThreadMessage[]
}

type LogsResponse = {
  success: boolean
  data?: {
    items: LogItem[]
    page: number
    limit: number
    total: number
    pages: number
  }
  error?: string
}

const channels: Array<{ value: ChannelFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'hunar', label: 'Call' },
]

const statuses = [
  { value: '', label: 'Any status' },
  { value: 'awaiting_reply', label: 'Awaiting reply' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'in_qualification', label: 'In qualification' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'not_qualified', label: 'Not qualified' },
  { value: 'in_screening', label: 'In screening' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'rejected', label: 'Rejected' },
]

const channelLabel = {
  gmail: 'Gmail',
  whatsapp: 'WhatsApp',
  hunar: 'Call',
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

function formatMessageTime(value?: string) {
  if (!value) return ''
  const numeric = Number(value)
  return formatTime(numeric ? new Date(numeric).toISOString() : value)
}

function formatStatus(status: string) {
  if (!status) return '—'
  return status.replace(/_/g, ' ')
}

function formatParty(item: { channel: string; party?: string }) {
  const value = String(item.party || '').trim()
  if (!value) return '—'
  if (item.channel !== 'gmail') return value
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match?.[0] || value
}

export default function Logs() {
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [tooltip, setTooltip] = useState<{
    item: LogItem
    top: number
    left: number
  } | null>(null)
  const hideTimer = useRef<number>(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      setQ((prev) => {
        if (prev !== next) setPage(1)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      channel,
    })
    if (q) params.set('q', q)
    if (status) params.set('status', status)

    fetch(`/api/v1/logs?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body: LogsResponse = await res.json()
        if (!res.ok || !body.success || !body.data) {
          throw new Error(
            typeof body.error === 'string' ? body.error : 'Failed to load logs'
          )
        }
        setItems(body.data.items)
        setTotal(body.data.total)
        setPages(body.data.pages)
        setTooltip(null)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Failed to load logs')
        setItems([])
        setTotal(0)
        setPages(1)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [channel, status, q, page, limit])

  useEffect(() => {
    return () => window.clearTimeout(hideTimer.current)
  }, [])

  function changeChannel(next: ChannelFilter) {
    setChannel(next)
    setPage(1)
  }

  function changeStatus(next: string) {
    setStatus(next)
    setPage(1)
  }

  function showThread(event: MouseEvent<HTMLElement>, item: LogItem) {
    window.clearTimeout(hideTimer.current)
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 360
    const estimatedHeight = 280
    const left = Math.min(rect.left, window.innerWidth - width - 12)
    const top =
      rect.bottom + 8 + estimatedHeight > window.innerHeight
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : rect.bottom + 8
    setTooltip({ item, top, left: Math.max(12, left) })
  }

  function scheduleHideThread() {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setTooltip(null), 120)
  }

  const thread = tooltip?.item.messages || []

  return (
    <main className="logs">
      <header className="queue-header">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>Logs</h1>
          <p className="lede">
            Gmail, WhatsApp, and call records from hcg collections.
          </p>
        </div>
        <p className="queue-count">
          {loading ? 'Loading…' : `${total} record${total === 1 ? '' : 's'}`}
        </p>
      </header>

      <div className="logs-toolbar">
        <div className="queue-filters" role="tablist" aria-label="Channel">
          {channels.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={channel === item.value}
              className={`queue-filter${channel === item.value ? ' is-active' : ''}`}
              onClick={() => changeChannel(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="logs-controls">
          <input
            className="logs-search"
            type="search"
            placeholder="Search email, phone, subject…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="logs-select"
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
            aria-label="Status"
          >
            {statuses.map((item) => (
              <option key={item.value || 'any'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="queue-table-wrap">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Party</th>
              <th>Status</th>
              <th>Preview</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={5} className="queue-empty">
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="queue-empty">
                  {loading ? 'Loading logs…' : 'No logs match these filters.'}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const threadCount =
                  item.channel === 'whatsapp' ? item.messages?.length || 0 : 0

                return (
                  <tr key={`${item.channel}-${item.id}`}>
                    <td>
                      <span className="queue-channel">{channelLabel[item.channel]}</span>
                      {item.direction ? (
                        <span className="logs-inline-meta">{item.direction}</span>
                      ) : null}
                    </td>
                    <td>{formatParty(item)}</td>
                    <td>
                      <span className={`queue-status status-log-${item.channel}`}>
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td
                      className="logs-preview-cell"
                      onMouseEnter={(event) => {
                        if (threadCount) showThread(event, item)
                      }}
                      onMouseLeave={scheduleHideThread}
                    >
                      <div className="logs-preview-row">
                        <span className="logs-preview">{item.preview || '—'}</span>
                        {threadCount ? (
                          <span className="logs-inline-meta">{threadCount}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>{formatTime(item.updatedAt)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="logs-pagination">
        <button
          type="button"
          className="queue-filter"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <p className="queue-count">
          Page {page} of {pages}
        </p>
        <button
          type="button"
          className="queue-filter"
          disabled={page >= pages || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>

      {tooltip && thread.length ? (
        <div
          className="logs-tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
          onMouseEnter={() => window.clearTimeout(hideTimer.current)}
          onMouseLeave={scheduleHideThread}
        >
          <p className="logs-tooltip-title">
            {tooltip.item.party || 'WhatsApp'} · {thread.length} messages
          </p>
          <ol className="logs-thread">
            {thread.map((message, index) => (
              <li
                key={message.messageId || `${tooltip.item.id}-${index}`}
                className={`logs-bubble logs-bubble-${message.direction || 'unknown'}`}
              >
                <span className="logs-bubble-meta">
                  {message.direction || 'message'}
                  {message.template ? ` · ${message.template}` : ''}
                  {message.internalDate
                    ? ` · ${formatMessageTime(message.internalDate)}`
                    : ''}
                </span>
                <span className="logs-bubble-body">{message.body || '—'}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </main>
  )
}
