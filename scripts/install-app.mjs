// Copies the packaged app into /Applications and launches it.
//
// macOS ties the Accessibility grant to the app's signature. Signed with the "Break Flow Dev"
// certificate, the grant carries over between builds. If the signer changed (or the build is ad
// hoc, which is different every time), the old grant silently stops working while still showing
// "on" in System Settings — so we clear it and macOS asks again cleanly. --keep-perms skips that.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

const BUNDLE_ID = 'com.obwoj1.breakflow'
const source = `dist/mac-${process.arch}/Break Flow.app`
const target = '/Applications/Break Flow.app'
const APP_PROCESS = 'Break Flow.app/Contents/MacOS/Break Flow'

if (!existsSync(source)) {
  console.error(`Not found: ${source} — run "npm run package" first.`)
  process.exit(1)
}

const previousSigner = existsSync(target) ? signer(target) : null
const newSigner = signer(source)

await quitRunningCopies()

rmSync(target, { recursive: true, force: true })
execFileSync('ditto', [source, target], { stdio: 'inherit' })

const signerChanged = newSigner === 'ad hoc' || previousSigner !== newSigner
if (signerChanged && !process.argv.includes('--keep-perms')) {
  spawnSync('tccutil', ['reset', 'Accessibility', BUNDLE_ID], { stdio: 'ignore' })
  console.log('Signer changed — switch Accessibility on again for Break Flow.')
}

execFileSync('open', [target])
console.log(`Installed and opened ${target} (signed: ${newSigner})`)

/** "Break Flow Dev", "ad hoc", or another authority name. */
function signer(app) {
  const { stderr } = spawnSync('codesign', ['-dvv', app], { encoding: 'utf8' })
  if (/Signature=adhoc/.test(stderr)) return 'ad hoc'
  return stderr.match(/^Authority=(.+)$/m)?.[1] ?? 'unknown'
}

function running() {
  return spawnSync('pgrep', ['-f', APP_PROCESS]).status === 0
}

/**
 * Asks Break Flow to quit and waits until it's really gone. Opening the new copy while the old one
 * is still shutting down makes macOS just re-activate the old one.
 */
async function quitRunningCopies() {
  if (!running()) return
  spawnSync('osascript', ['-e', `tell application id "${BUNDLE_ID}" to quit`], { stdio: 'ignore' })
  for (let waited = 0; waited < 5000 && running(); waited += 250) {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (running()) {
    console.warn('Break Flow did not quit in time; force-quitting it.')
    spawnSync('pkill', ['-9', '-f', APP_PROCESS], { stdio: 'ignore' })
  }
  spawnSync('pkill', ['-x', 'BreakFlowHelper'], { stdio: 'ignore' })
}
