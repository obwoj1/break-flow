import { useState } from 'react'
import type { HistoryEntry } from '../../../shared/types'
import { timeAgo, wordCount } from '../useBreakFlow'

/** Past transcripts with copy and delete. */
export function HistoryList({ entries, limit }: { entries: HistoryEntry[]; limit?: number }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showingOriginal, setShowingOriginal] = useState<Set<string>>(new Set())
  const shown = limit ? entries.slice(0, limit) : entries

  if (shown.length === 0) {
    return <p className="empty">Nothing yet — your dictations will show up here.</p>
  }

  function toggleOriginal(id: string) {
    setShowingOriginal((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copy(entry: HistoryEntry, text: string) {
    await window.breakFlow.copyText(text)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500)
  }

  return (
    <ul className="history">
      {shown.map((entry) => {
        const original = showingOriginal.has(entry.id) && entry.rawText !== undefined
        const text = original ? entry.rawText! : entry.text
        return (
          <li key={entry.id}>
            <p className={`history-text ${original ? 'original' : ''}`}>{text}</p>
            <div className="history-meta">
              <span>
                {timeAgo(entry.createdAt)}
                {entry.app && ` · ${entry.app}`} · {wordCount(entry.text)} words · {entry.durationSeconds.toFixed(1)}s
              </span>
              <span className="history-actions">
                {entry.rawText !== undefined && (
                  <button className="link" onClick={() => toggleOriginal(entry.id)}>
                    {original ? 'Show cleaned' : 'Show original'}
                  </button>
                )}
                <button className="link" onClick={() => void copy(entry, text)}>
                  {copiedId === entry.id ? 'Copied' : 'Copy'}
                </button>
                <button className="link danger" onClick={() => void window.breakFlow.deleteHistoryEntry(entry.id)}>
                  Delete
                </button>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
