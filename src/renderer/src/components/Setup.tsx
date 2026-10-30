import type { ReactNode } from 'react'
import type { AppState } from '../../../shared/types'
import { ApiKeyForm } from './ApiKeyForm'

export function isSetupDone(state: AppState): boolean {
  return state.microphone === 'granted' && state.accessibility && state.hasApiKey
}

/** The three things Break Flow needs before it can work, each with a button to fix it. */
export function Setup({ state }: { state: AppState }) {
  return (
    <section className="card setup">
      <h2>Finish setting up</h2>
      <p className="muted">Three quick steps, then hold the hotkey anywhere to talk.</p>
      <ol className="steps">
        <Step
          done={state.microphone === 'granted'}
          title="Microphone"
          detail="So Break Flow can hear you while you hold the hotkey."
          action={
            <button onClick={() => void window.breakFlow.requestMicrophone()}>
              {state.microphone === 'not-determined' ? 'Allow' : 'Open Settings'}
            </button>
          }
        />
        <Step
          done={state.accessibility}
          title="Accessibility"
          detail="So it can notice the hotkey in other apps and type for you. Switch on Break Flow in the list — this page updates by itself."
          action={<button onClick={() => void window.breakFlow.requestAccessibility()}>Open Settings</button>}
        />
        <Step done={state.hasApiKey} title="OpenAI API key" detail="Turns your voice into text.">
          {!state.hasApiKey && <ApiKeyForm />}
        </Step>
      </ol>
    </section>
  )
}

function Step(props: { done: boolean; title: string; detail: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <li className={`step ${props.done ? 'done' : ''}`}>
      <span className="check" aria-hidden>
        {props.done ? '✓' : ''}
      </span>
      <div className="step-body">
        <div className="step-head">
          <div>
            <strong>{props.title}</strong>
            {!props.done && <p className="muted">{props.detail}</p>}
          </div>
          {!props.done && props.action}
        </div>
        {props.children}
      </div>
    </li>
  )
}
