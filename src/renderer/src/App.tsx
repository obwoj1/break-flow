import { useState } from 'react'
import type { AppState, HistoryEntry } from '../../shared/types'
import { HistoryList } from './components/HistoryList'
import { SettingsPage } from './components/SettingsPage'
import { isSetupDone, Setup } from './components/Setup'
import { HOTKEY_LABELS, useBreakFlow } from './useBreakFlow'

type Page = 'home' | 'history' | 'settings'

const PAGES: { id: Page; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

export function App() {
  const { state, history } = useBreakFlow()
  const [page, setPage] = useState<Page>('home')

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Break Flow</div>
        {PAGES.map(({ id, label }) => (
          <button key={id} className={`nav ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
            {label}
            {id === 'home' && state && !isSetupDone(state) && <span className="nav-dot" aria-label="Setup needed" />}
          </button>
        ))}
      </nav>

      <main className="content">
        {!state ? null : page === 'home' ? (
          <Home state={state} history={history} onSeeAll={() => setPage('history')} />
        ) : page === 'history' ? (
          <HistoryPage history={history} />
        ) : (
          <SettingsPage state={state} />
        )}
      </main>
    </div>
  )
}

function Home({ state, history, onSeeAll }: { state: AppState; history: HistoryEntry[]; onSeeAll: () => void }) {
  const hotkey = HOTKEY_LABELS[state.hotkey]
  const ready = isSetupDone(state)

  return (
    <>
      {!state.helperRunning && (
        <p className="banner danger">The background helper isn't running. Try quitting and reopening Break Flow.</p>
      )}
      {state.error && <p className="banner">{state.error}</p>}

      {!ready && <Setup state={state} />}

      <section className={`hero ${state.status}`}>
        <kbd className="big-key">{hotkey.key}</kbd>
        <h1>{headline(state, hotkey.name)}</h1>
        <p className="muted">
          {ready
            ? 'Works in any app — click into a text box, hold the key, talk, let go.'
            : 'Finish the steps above to start dictating.'}
        </p>
      </section>

      <section className="card">
        <div className="row">
          <h2>Recent</h2>
          {history.length > 3 && (
            <button className="link" onClick={onSeeAll}>
              See all
            </button>
          )}
        </div>
        <HistoryList entries={history} limit={3} />
      </section>
    </>
  )
}

function headline(state: AppState, hotkeyName: string): string {
  if (state.status === 'recording') return 'Listening…'
  if (state.status === 'transcribing') return 'Typing it out…'
  return `Hold ${hotkeyName} and talk`
}

function HistoryPage({ history }: { history: HistoryEntry[] }) {
  return (
    <section className="card">
      <div className="row">
        <h2>History</h2>
        {history.length > 0 && (
          <button
            className="link danger"
            onClick={() => {
              if (confirm('Delete all transcripts? This can’t be undone.')) void window.breakFlow.clearHistory()
            }}
          >
            Clear all
          </button>
        )}
      </div>
      <HistoryList entries={history} />
    </section>
  )
}
