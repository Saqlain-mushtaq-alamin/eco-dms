// Copies the Hardhat artifact ABI into subgraph/abis
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const artifact = resolve(__dirname, '../../contracts/artifacts/contracts/ProfileRegistry.sol/ProfileRegistry.json')
const destDir = resolve(__dirname, '../abis')
const dest = resolve(destDir, 'ProfileRegistry.json')

if (!existsSync(artifact)) {
    console.error('Artifact not found, compile contracts first: pnpm --filter eco-dms-contracts build')
    process.exit(1)
}
mkdirSync(destDir, { recursive: true })
copyFileSync(artifact, dest)
console.log('Copied ABI to subgraph/abis/ProfileRegistry.json')