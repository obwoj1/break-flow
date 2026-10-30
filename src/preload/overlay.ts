import { contextBridge, ipcRenderer } from 'electron'
import type { DictationStatus } from '../shared/types'

// The pill only listens; it can't call anything in the main process.
contextBridge.exposeInMainWorld('overlay', {
  onStatus: (listener: (status: DictationStatus) => void) =>
    ipcRenderer.on('overlay:status', (_event, status: DictationStatus) => listener(status)),
  onLevel: (listener: (level: number) => void) =>
    ipcRenderer.on('overlay:level', (_event, level: number) => listener(level)),
})
