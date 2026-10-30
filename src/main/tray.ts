import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import type { AppState, DictationStatus, HotkeyName } from '../shared/types'

const HOTKEY_TITLES: Record<HotkeyName, string> = {
  fn: 'Fn (🌐)',
  rightOption: 'Right Option (⌥)',
}

const ICONS: Record<DictationStatus, string> = {
  idle: 'trayIdleTemplate.png',
  recording: 'trayRecordingTemplate.png',
  transcribing: 'trayTranscribingTemplate.png',
}

interface TrayActions {
  openWindow(): void
  setHotkey(hotkey: HotkeyName): void
}

/** The menu bar icon: shows idle / recording / transcribing, with a small menu. */
export class AppTray {
  private readonly tray: Tray
  private readonly icons: Record<DictationStatus, Electron.NativeImage>

  constructor(private readonly actions: TrayActions) {
    this.icons = {
      idle: loadIcon(ICONS.idle),
      recording: loadIcon(ICONS.recording),
      transcribing: loadIcon(ICONS.transcribing),
    }
    this.tray = new Tray(this.icons.idle)
    this.tray.setToolTip('Break Flow')
  }

  update(state: AppState): void {
    this.tray.setImage(this.icons[state.status])
    this.tray.setContextMenu(this.buildMenu(state))
  }

  private buildMenu(state: AppState): Menu {
    const setupDone = state.hasApiKey && state.accessibility && state.microphone === 'granted'
    const headline = !setupDone
      ? '⚠️ Finish setup in the Break Flow window'
      : state.status === 'recording'
        ? 'Listening…'
        : state.status === 'transcribing'
          ? 'Transcribing…'
          : `Hold ${HOTKEY_TITLES[state.hotkey]} to talk`

    return Menu.buildFromTemplate([
      { label: headline, enabled: false },
      ...(state.error ? [{ label: state.error, enabled: false }] : []),
      { type: 'separator' },
      { label: 'Open Break Flow', click: () => this.actions.openWindow() },
      {
        label: 'Hotkey',
        submenu: (Object.keys(HOTKEY_TITLES) as HotkeyName[]).map((hotkey) => ({
          label: HOTKEY_TITLES[hotkey],
          type: 'radio' as const,
          checked: state.hotkey === hotkey,
          click: () => this.actions.setHotkey(hotkey),
        })),
      },
      { type: 'separator' },
      { label: 'Quit Break Flow', accelerator: 'Command+Q', click: () => app.quit() },
    ])
  }
}

function loadIcon(file: string): Electron.NativeImage {
  // resources/ ships inside the app (see electron-builder.yml → files); @2x is picked up automatically.
  const image = nativeImage.createFromPath(join(app.getAppPath(), 'resources', file))
  image.setTemplateImage(true)
  return image
}
