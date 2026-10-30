import { useState, type FormEvent } from 'react'

/** Paste-and-save field for the OpenAI key. The main process checks the key with OpenAI before saving. */
export function ApiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const result = await window.breakFlow.saveApiKey(key)
    setSaving(false)
    if (result.ok) {
      setKey('')
      onSaved?.()
    } else {
      setError(result.error)
    }
  }

  return (
    <form className="key-form" onSubmit={submit}>
      <div className="key-row">
        <input
          type="password"
          placeholder="sk-…"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="OpenAI API key"
        />
        <button type="submit" className="primary" disabled={!key.trim() || saving}>
          {saving ? 'Checking…' : 'Save'}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <p className="hint">
        Get one at{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
          platform.openai.com/api-keys
        </a>
        . It's encrypted with your Mac's Keychain and only ever sent to OpenAI.
      </p>
    </form>
  )
}
