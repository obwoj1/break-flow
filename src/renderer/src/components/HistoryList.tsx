import { useState } from 'react'
import type { HistoryEntry } from '../../../shared/types'
import { timeAgo, wordCount } from '../useBreakFlow'

/** Past transcripts with copy and delete. */
export function HistoryList({ entries, limit }: { entries: HistoryEntry[]; limit?: number }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const shown = limit ? entries.slice(0, limit) : entries

  if (shown.length === 0) {
    return <p className="empty">Nothing yet — your dictations will show up here.</p>
  }

  async function copy(entry: HistoryEntry) {
    await window.breakFlow.copyText(entry.text)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500)
  }

  return (
    <ul className="history">
      {shown.map((entry) => (
        <li key={entry.id}>
          <p className="history-text">{entry.text}</p>
          <div className="history-meta">
            <span>
              {timeAgo(entry.createdAt)} · {wordCount(entry.text)} words · {entry.durationSeconds.toFixed(1)}s
            </span>
            <span className="history-actions">
              <button className="link" onClick={() => void copy(entry)}>
                {copiedId === entry.id ? 'Copied' : 'Copy'}
              </button>
              <button className="link danger" onClick={() => void window.breakFlow.deleteHistoryEntry(entry.id)}>
                Delete
              </button>
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
