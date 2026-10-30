// Signs the packaged app.
//
// With the "Break Flow Dev" certificate (scripts/setup-signing.sh) every build has the same
// identity, so macOS keeps the Accessibility grant and Keychain access between builds. Without it
// we fall back to an ad hoc signature, which works but makes macOS treat each build as a new app.
//
// Apple Silicon refuses to run unsigned code, and electron-builder skips signing (identity: null),
// so everything — the Swift helper, Electron's frameworks and the app — is signed here.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const IDENTITY = 'Break Flow Dev'
const KEYCHAIN = join(homedir(), 'Library/Keychains/break-flow-dev.keychain-db')
const PASSWORD_FILE = join(homedir(), '.config/break-flow/signing-keychain-password')

const app = `dist/mac-${process.arch}/Break Flow.app`
if (!existsSync(app)) {
  console.error(`Not found: ${app} — run electron-builder first.`)
  process.exit(1)
}

const hasCertificate =
  existsSync(KEYCHAIN) &&
  existsSync(PASSWORD_FILE) &&
  spawnSync('security', ['find-identity', '-p', 'codesigning', KEYCHAIN], { encoding: 'utf8' }).stdout.includes(
    `"${IDENTITY}"`,
  )

let signArgs
if (hasCertificate) {
  const password = readFileSync(PASSWORD_FILE, 'utf8').trim()
  execFileSync('security', ['unlock-keychain', '-p', password, KEYCHAIN])
  signArgs = ['--force', '--sign', IDENTITY, '--keychain', KEYCHAIN]
} else {
  console.warn('No "Break Flow Dev" certificate — signing ad hoc. Run scripts/setup-signing.sh to fix permission resets.')
  signArgs = ['--force', '--sign', '-']
}

// The helper sits in Resources/, where --deep doesn't look, so sign it first on its own.
execFileSync('codesign', [...signArgs, `${app}/Contents/Resources/bin/BreakFlowHelper`], { stdio: 'inherit' })
execFileSync('codesign', [...signArgs, '--deep', app], { stdio: 'inherit' })
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
console.log(`Signed (${hasCertificate ? IDENTITY : 'ad hoc'}): ${app}`)
