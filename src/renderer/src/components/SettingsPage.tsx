import { useState } from 'react'
import type { AppState, HotkeyName } from '../../../shared/types'
import { HOTKEY_LABELS } from '../useBreakFlow'
import { ApiKeyForm } from './ApiKeyForm'
import { DictionaryEditor } from './DictionaryEditor'

export function SettingsPage({ state }: { state: AppState }) {
  const [changingKey, setChangingKey] = useState(false)

  return (
    <>
      <section className="card">
        <h2>Hotkey</h2>
        <p className="muted">Hold it, talk, let go.</p>
        <div className="choices">
          {(Object.keys(HOTKEY_LABELS) as HotkeyName[]).map((hotkey) => (
            <button
              key={hotkey}
              className={`choice ${state.hotkey === hotkey ? 'selected' : ''}`}
              onClick={() => void window.breakFlow.setHotkey(hotkey)}
            >
              <kbd>{HOTKEY_LABELS[hotkey].key}</kbd>
              {HOTKEY_LABELS[hotkey].name}
            </button>
          ))}
        </div>
        {state.hotkey === 'fn' && (
          <p className="hint">
            If Fn opens the emoji picker, set System Settings → Keyboard → “Press 🌐 key to” → Do Nothing.
          </p>
        )}
      </section>

      <section className="card">
        <div className="row">
          <div>
            <h2>AI cleanup</h2>
            <p className="muted">
              Removes “um”s and false starts, fixes punctuation, and applies “no wait, I meant…” before typing.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={state.cleanupEnabled}
              onChange={(event) => void window.breakFlow.setCleanupEnabled(event.target.checked)}
            />
            <span aria-hidden />
            <span className="visually-hidden">AI cleanup</span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Dictionary</h2>
        <p className="muted">Words Break Flow should always spell exactly — names, products, jargon.</p>
        <DictionaryEditor words={state.dictionary} />
      </section>

      <section className="card">
        <h2>OpenAI API key</h2>
        {state.hasApiKey && !changingKey ? (
          <div className="row">
            <p className="muted">Saved in your Keychain.</p>
            <span className="row-actions">
              <button onClick={() => setChangingKey(true)}>Change</button>
              <button className="danger" onClick={() => void window.breakFlow.removeApiKey()}>
                Remove
              </button>
            </span>
          </div>
        ) : (
          <ApiKeyForm onSaved={() => setChangingKey(false)} />
        )}
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <p className="muted">
          While you hold the hotkey, Break Flow records your mic. The recording is sent to OpenAI (
          <code>gpt-transcribe</code>) and deleted from your Mac as soon as the text comes back. With AI cleanup on, the
          text and the name of the app you're typing into go to OpenAI (<code>gpt-6-luna</code>) too, with storage on
          their side turned off. Transcripts are kept only in your history on this Mac.
        </p>
      </section>
    </>
  )
}
