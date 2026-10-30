import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { DictationStatus } from '../shared/types'

const WIDTH = 120
const HEIGHT = 36
/** Gap between the pill and the bottom of the screen (above the Dock). */
const BOTTOM_MARGIN = 28

/**
 * The floating pill at the bottom of the screen: live sound bars while you talk, dots while
 * transcribing, hidden otherwise.
 *
 * It must never take focus — the text gets pasted into whatever app is in front, so the pill is
 * a non-focusable panel shown "inactive" and ignores the mouse entirely.
 */
export class Overlay {
  private window: BrowserWindow | null = null

  setStatus(status: DictationStatus): void {
    if (status === 'idle') {
      this.window?.hide()
      return
    }
    const window = this.ensureWindow()
    this.placeOnActiveScreen(window)
    window.webContents.send('overlay:status', status)
    if (!window.isVisible()) window.showInactive()
  }

  setLevel(level: number): void {
    this.window?.webContents.send('overlay:level', level)
  }

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window

    const window = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      type: 'panel', // macOS: floats over other apps, including full-screen ones
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/overlay.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    })
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    window.setIgnoreMouseEvents(true)
    window.webContents.on('will-navigate', (event) => event.preventDefault())

    const devServer = process.env['ELECTRON_RENDERER_URL']
    if (!app.isPackaged && devServer) {
      void window.loadURL(`${devServer}/overlay.html`)
    } else {
      void window.loadFile(join(import.meta.dirname, '../renderer/overlay.html'))
    }

    this.window = window
    return window
  }

  /** Bottom-center of the screen the mouse is on, so it shows up where you're working. */
  private placeOnActiveScreen(window: BrowserWindow): void {
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    window.setPosition(
      Math.round(workArea.x + (workArea.width - WIDTH) / 2),
      Math.round(workArea.y + workArea.height - HEIGHT - BOTTOM_MARGIN),
    )
  }
}
