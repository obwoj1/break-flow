// Copies the packaged app into /Applications and launches it.
//
// Every ad hoc build looks like a brand-new app to macOS, so the old Accessibility grant stops
// working while still showing as "on" in System Settings. We clear it so macOS asks again cleanly.
// Pass --keep-perms to skip that.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

const BUNDLE_ID = 'com.obwoj1.breakflow'
const source = `dist/mac-${process.arch}/Break Flow.app`
const target = '/Applications/Break Flow.app'

if (!existsSync(source)) {
  console.error(`Not found: ${source} — run "npm run package" first.`)
  process.exit(1)
}

// Quit the running copy (Electron main process and the Swift helper).
spawnSync('osascript', ['-e', `tell application id "${BUNDLE_ID}" to quit`], { stdio: 'ignore' })
spawnSync('pkill', ['-x', 'BreakFlowHelper'], { stdio: 'ignore' })

rmSync(target, { recursive: true, force: true })
execFileSync('ditto', [source, target], { stdio: 'inherit' })

if (!process.argv.includes('--keep-perms')) {
  spawnSync('tccutil', ['reset', 'Accessibility', BUNDLE_ID], { stdio: 'ignore' })
}

execFileSync('open', [target])
console.log(`Installed and opened ${target}`)
