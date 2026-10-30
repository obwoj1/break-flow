import type { DictationStatus } from '../../shared/types'
import './overlay.css'

declare global {
  interface Window {
    overlay: {
      onStatus(listener: (status: DictationStatus) => void): void
      onLevel(listener: (level: number) => void): void
    }
  }
}

const BAR_COUNT = 9
/** Middle bars move most, edges least — reads as a voice waveform rather than a meter. */
const BAR_WEIGHTS = Array.from({ length: BAR_COUNT }, (_, index) => {
  const fromCenter = Math.abs(index - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2)
  return 1 - fromCenter * 0.6
})

const pill = document.getElementById('pill')!
const barsContainer = document.getElementById('bars')!
const bars = BAR_WEIGHTS.map(() => {
  const bar = document.createElement('span')
  barsContainer.append(bar)
  return bar
})

let target = 0
let current = 0

window.overlay.onStatus((status) => {
  pill.dataset.status = status
  if (status !== 'recording') target = 0
})

// Levels arrive ~10×/s; animate toward them every frame so the bars move smoothly.
window.overlay.onLevel((level) => {
  target = level
})

function frame(time: number): void {
  current += (target - current) * 0.25
  bars.forEach((bar, index) => {
    const wobble = 0.75 + 0.25 * Math.sin(time / 120 + index * 1.7)
    const height = 0.15 + 0.85 * current * BAR_WEIGHTS[index] * wobble
    bar.style.transform = `scaleY(${height.toFixed(3)})`
  })
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
