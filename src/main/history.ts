import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HistoryEntry } from '../shared/types'

/** Older entries are dropped past this many. */
const MAX_ENTRIES = 500

/** Past transcripts, newest first, saved to ~/Library/Application Support/Break Flow/history.json. */
export class History {
  private readonly path = join(app.getPath('userData'), 'history.json')
  private entries: HistoryEntry[]

  constructor() {
    this.entries = this.load()
  }

  list(): HistoryEntry[] {
    return this.entries
  }

  add(text: string, durationSeconds: number): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      durationSeconds,
    }
    this.entries = [entry, ...this.entries].slice(0, MAX_ENTRIES)
    this.save()
    return entry
  }

  remove(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id)
    this.save()
  }

  clear(): void {
    this.entries = []
    this.save()
  }

  private load(): HistoryEntry[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
    } catch {
      return []
    }
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.entries, null, 2), { mode: 0o600 })
  }
}
