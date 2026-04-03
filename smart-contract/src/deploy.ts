/**
 * AlgoEscrow — LocalNet Deploy Script
 *
 * Deploys EscrowContract (template) and EscrowFactory to LocalNet.
 * Run with: npx ts-node src/deploy.ts
 * Or via:   algokit project deploy localnet
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'

async function deploy() {
  // Connect to LocalNet
  const algorand = AlgorandClient.fromEnvironment()

  // Get the deployer account from LocalNet KMD
  const deployer = await algorand.account.fromKmd('unencrypted-default-wallet')

  console.log(`\n🚀 AlgoEscrow Deploy Script`)
  console.log(`Network: ${process.env.ALGORAND_NETWORK ?? 'localnet'}`)
  console.log(`Deployer: ${deployer.addr}\n`)

  // NOTE: After running `algokit project run build`, the compiled artifacts
  // are in ./artifacts/. The TypedAppClients generated from those artifacts
  // are what you use below. This script is a placeholder — update after build.

  console.log(`✅ Deploy script ready.`)
  console.log(`Run: algokit project run build  (compiles contracts)`)
  console.log(`Then: algokit project deploy localnet  (deploys to LocalNet)`)
}

deploy().catch(console.error)
