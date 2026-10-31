import { useState, type FormEvent } from 'react'

/** Add/remove words that should always be spelled a certain way (names, products, jargon). */
export function DictionaryEditor({ words }: { words: string[] }) {
  const [draft, setDraft] = useState('')

  async function add(event: FormEvent) {
    event.preventDefault()
    // Commas let you paste several at once: "Oba, Morgan State, Supabase".
    const additions = draft.split(',').map((word) => word.trim()).filter(Boolean)
    if (additions.length === 0) return
    await window.breakFlow.setDictionary([...words, ...additions])
    setDraft('')
  }

  return (
    <>
      <form className="key-row dictionary-form" onSubmit={add}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a name or term — e.g. Oba, Supabase, Morgan State"
          aria-label="Add a dictionary word"
          spellCheck={false}
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      {words.length > 0 ? (
        <ul className="chips">
          {words.map((word) => (
            <li key={word}>
              {word}
              <button
                className="chip-remove"
                aria-label={`Remove ${word}`}
                onClick={() => void window.breakFlow.setDictionary(words.filter((other) => other !== word))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No words yet. Add names and jargon that get misspelled.</p>
      )}
    </>
  )
}
