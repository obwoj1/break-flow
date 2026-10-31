import { app, BrowserWindow, clipboard, ipcMain, shell, systemPreferences, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import type { HotkeyName } from '../shared/types'
import { Dictation } from './dictation'
import { HelperProcess } from './helper'
import { History } from './history'
import { Overlay } from './overlay'
import { Settings } from './settings'
import { verifyApiKey } from './transcriber'
import { AppTray } from './tray'

const ACCESSIBILITY_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
const MICROPHONE_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'

let mainWindow: BrowserWindow | null = null
let quitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.whenReady().then(start)
}

function start(): void {
  const settings = new Settings()
  const history = new History()
  const helper = new HelperProcess()
  const dictation = new Dictation(helper, settings, history)

  const tray = new AppTray({
    openWindow: showWindow,
    setHotkey: (hotkey) => dictation.setHotkey(hotkey),
  })

  const overlay = new Overlay()

  dictation.on('state', (state) => {
    tray.update(state)
    overlay.setStatus(state.status)
    mainWindow?.webContents.send('state', state)
  })
  dictation.on('level', (level: number) => overlay.setLevel(level))
  dictation.on('history', () => mainWindow?.webContents.send('history', history.list()))
  dictation.on('needs-attention', showWindow)

  // Start the helper before anything reads settings: reading the API key can wait on a Keychain
  // prompt, and the hotkey should be listening regardless.
  dictation.start()
  registerIpc(dictation, history)
  createWindow()
  tray.update(dictation.snapshot())

  // Permissions can change in System Settings while we're in the background.
  app.on('browser-window-focus', () => dictation.emitState())
  app.on('activate', showWindow)
  app.on('before-quit', () => {
    quitting = true
    helper.stop()
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'Break Flow',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#00000000',
    vibrancy: 'sidebar',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Closing the window keeps Break Flow running in the menu bar; Quit really quits.
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Links open in the browser; the window itself never navigates away from the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServer) {
    void mainWindow.loadURL(devServer)
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (!mainWindow) createWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

/** Like ipcMain.handle, but only answers our own window. */
function handle(channel: string, listener: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (event.sender !== mainWindow?.webContents) throw new Error('Unknown sender')
    return listener(...args)
  })
}

function registerIpc(dictation: Dictation, history: History): void {
  handle('state:get', () => dictation.snapshot())

  handle('history:list', () => history.list())
  handle('history:delete', (id) => {
    if (typeof id !== 'string') return
    history.remove(id)
    mainWindow?.webContents.send('history', history.list())
  })
  handle('history:clear', () => {
    history.clear()
    mainWindow?.webContents.send('history', history.list())
  })

  handle('clipboard:copy', (text) => {
    if (typeof text === 'string') clipboard.writeText(text)
  })

  handle('settings:set-hotkey', (hotkey) => {
    if (hotkey === 'fn' || hotkey === 'rightOption') dictation.setHotkey(hotkey as HotkeyName)
  })

  handle('settings:set-cleanup', (enabled) => {
    if (typeof enabled === 'boolean') dictation.setCleanupEnabled(enabled)
  })

  handle('settings:set-dictionary', (words) => (Array.isArray(words) ? dictation.setDictionary(words) : []))

  handle('settings:save-api-key', async (raw) => {
    const key = typeof raw === 'string' ? raw.trim() : ''
    if (!key || key.length > 512) return { ok: false, error: 'Paste your OpenAI API key.' }
    const problem = await verifyApiKey(key)
    if (problem) return { ok: false, error: problem }
    try {
      dictation.saveApiKey(key)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
  handle('settings:remove-api-key', () => dictation.removeApiKey())

  handle('permissions:request-microphone', async () => {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone')
    } else if (status !== 'granted') {
      await shell.openExternal(MICROPHONE_SETTINGS) // macOS only asks once; after that it's Settings
    }
    dictation.emitState()
  })

  handle('permissions:request-accessibility', async () => {
    if (!systemPreferences.isTrustedAccessibilityClient(true)) {
      await shell.openExternal(ACCESSIBILITY_SETTINGS)
    }
    dictation.emitState()
  })
}
