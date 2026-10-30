import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppState, BreakFlowApi, HistoryEntry } from '../shared/types'

/** Subscribes to a push channel from the main process; returns an unsubscribe function. */
function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, value: T) => listener(value)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

// The UI only gets these named functions, never ipcRenderer or Node itself.
const api: BreakFlowApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (listener) => subscribe<AppState>('state', listener),
  getHistory: () => ipcRenderer.invoke('history:list'),
  onHistory: (listener) => subscribe<HistoryEntry[]>('history', listener),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  copyText: (text) => ipcRenderer.invoke('clipboard:copy', text),
  setHotkey: (hotkey) => ipcRenderer.invoke('settings:set-hotkey', hotkey),
  saveApiKey: (key) => ipcRenderer.invoke('settings:save-api-key', key),
  removeApiKey: () => ipcRenderer.invoke('settings:remove-api-key'),
  requestMicrophone: () => ipcRenderer.invoke('permissions:request-microphone'),
  requestAccessibility: () => ipcRenderer.invoke('permissions:request-accessibility'),
}

contextBridge.exposeInMainWorld('breakFlow', api)
