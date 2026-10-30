import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

/** Events the Swift helper sends (see helper/Sources/BreakFlowHelper/Helper.swift). */
export type HelperEvent =
  | { type: 'ready' | 'status'; accessibility: boolean; microphone: boolean; recording: boolean }
  | { type: 'accessibility'; trusted: boolean }
  | { type: 'recording-started' }
  | { type: 'recording-finished'; path: string; duration: number; app?: string }
  | { type: 'recording-discarded'; reason: string }
  | { type: 'recording-blocked'; reason: 'disabled' | 'microphone' }
  | { type: 'pasted' }
  | { type: 'error'; message: string }

export type HelperCommand =
  | { cmd: 'configure'; hotkey?: string; enabled?: boolean }
  | { cmd: 'paste'; text: string }
  | { cmd: 'status' }

/** Give up restarting after this many crashes within RESTART_WINDOW_MS. */
const MAX_RESTARTS = 5
const RESTART_WINDOW_MS = 60_000

/**
 * Starts the Swift helper as a child process and talks to it in JSON lines over stdin/stdout.
 * Restarts it if it crashes. Emits 'event' (HelperEvent) and 'running' (boolean).
 */
export class HelperProcess extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private stopping = false
  private restarts: number[] = []

  get running(): boolean {
    return this.child !== null
  }

  start(): void {
    this.stopping = false
    const child = spawn(helperPath(), [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child

    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        this.emit('event', JSON.parse(line) as HelperEvent)
      } catch {
        console.error('[helper] unreadable line:', line)
      }
    })
    createInterface({ input: child.stderr }).on('line', (line) => console.error('[helper]', line))

    child.on('error', (error) => console.error('[helper] failed to start:', error.message))
    child.on('exit', (code, signal) => {
      this.child = null
      this.emit('running', false)
      if (!this.stopping) this.restartAfterCrash(code, signal)
    })
    this.emit('running', true)
  }

  send(command: HelperCommand): void {
    this.child?.stdin.write(JSON.stringify(command) + '\n')
  }

  stop(): void {
    this.stopping = true
    this.child?.stdin.end() // the helper exits when its stdin closes
    this.child = null
  }

  private restartAfterCrash(code: number | null, signal: NodeJS.Signals | null): void {
    const now = Date.now()
    this.restarts = this.restarts.filter((time) => now - time < RESTART_WINDOW_MS)
    if (this.restarts.length >= MAX_RESTARTS) {
      console.error('[helper] crashed too often; not restarting')
      return
    }
    this.restarts.push(now)
    console.error(`[helper] exited (code ${code}, signal ${signal}); restarting`)
    setTimeout(() => this.start(), 1000)
  }
}

/** Packaged: inside the app's Resources. Development: the Swift build output. */
function helperPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bin', 'BreakFlowHelper')
    : join(app.getAppPath(), 'helper', '.build', 'release', 'BreakFlowHelper')
}
