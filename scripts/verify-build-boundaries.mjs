import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const cliBundlePath = resolve(root, 'dist-cli', 'treebranch.js')
const webEntryPath = resolve(root, 'dist', 'index.html')
const webAssetsPath = resolve(root, 'dist', 'assets')
const nodeRuntimeMarker = 'The treebranch CLI requires a Node.js runtime.'

const cliBundle = await readFile(cliBundlePath, 'utf8')
await readFile(webEntryPath, 'utf8')

if (!cliBundle.startsWith('#!/usr/bin/env node\n')) {
  throw new Error('CLI bundle is missing its Node.js shebang.')
}

const webAssetNames = await readdir(webAssetsPath)
const webJavaScriptAssets = webAssetNames.filter((name) => name.endsWith('.js'))

if (webJavaScriptAssets.length === 0) {
  throw new Error('Browser build did not produce a JavaScript asset.')
}

for (const assetName of webJavaScriptAssets) {
  const asset = await readFile(resolve(webAssetsPath, assetName), 'utf8')

  if (asset.includes(nodeRuntimeMarker)) {
    throw new Error(`Node CLI runtime code leaked into Browser asset: ${assetName}`)
  }
}

const cliHelp = await runNode(cliBundlePath, ['--help'])

if (!cliHelp.includes('treebranch render <repository-path>')) {
  throw new Error('Built CLI did not return the expected help output.')
}

console.log('Build boundaries verified: Browser and Node CLI outputs are isolated.')

function runNode(entryPath, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(process.execPath, [entryPath, ...args], { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        rejectPromise(error)
        return
      }

      resolvePromise(stdout)
    })
  })
}
