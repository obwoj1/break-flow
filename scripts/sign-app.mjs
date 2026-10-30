// Signs the packaged app ad hoc (no certificate needed).
// Apple Silicon Macs refuse to run unsigned apps, and electron-builder skips signing without a
// certificate (identity: null), so we sign the whole bundle — app, helper and frameworks — here.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const app = `dist/mac-${process.arch}/Break Flow.app`
if (!existsSync(app)) {
  console.error(`Not found: ${app} — run electron-builder first.`)
  process.exit(1)
}

execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
console.log(`Signed (ad hoc): ${app}`)
