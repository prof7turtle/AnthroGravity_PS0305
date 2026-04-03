/**
 * AlgoEscrow — LocalNet Deploy Script
 *
 * Deploys EscrowContract (template) and EscrowFactory to LocalNet.
 * Run with: npx ts-node src/deploy.ts
 * Or via:   algokit project deploy localnet
 */

import { AlgorandClient, algos } from '@algorandfoundation/algokit-utils'
import { EscrowContractFactory } from './contracts/EscrowContractClient'
import { EscrowFactoryFactory } from './contracts/EscrowFactoryClient'
import * as fs from 'fs'
import * as path from 'path'

async function deploy() {
  // Connect to LocalNet
  const algorand = AlgorandClient.fromEnvironment()

  // Get the deployer account from LocalNet KMD
  const deployer = await algorand.account.fromKmd('unencrypted-default-wallet')
  
  // Treasury and Arbiter will just be the deployer wallet for local testing
  const treasury = deployer.addr
  const arbiter = deployer.addr

  console.log(`\n🚀 AlgoEscrow Deploy Script`)
  console.log(`Network: ${process.env.ALGORAND_NETWORK ?? 'localnet'}`)
  console.log(`Deployer: ${deployer.addr}\n`)

  // 1. Deploy EscrowContract template first
  console.log('Deploying EscrowContract (Template)...')
  const escrowContractResult = await algorand.client
    .getTypedAppFactory(EscrowContractFactory, { defaultSender: deployer.addr })
    .deploy({ createParams: { method: 'createApplication', args: [] } })

  const escrowContractAppId = escrowContractResult.appId
  console.log(`✅ EscrowContract template App ID: ${escrowContractAppId}`)

  // 2. Deploy EscrowFactory with template reference
  console.log('\nDeploying EscrowFactory...')
  const escrowFactoryResult = await algorand.client
    .getTypedAppFactory(EscrowFactoryFactory, { defaultSender: deployer.addr })
    .deploy({
      createParams: {
        method: 'createApplication',
        args: [treasury, 50n, arbiter],
      }
    })

  const factoryAppId = escrowFactoryResult.appId
  const factoryAddress = escrowFactoryResult.appAddress
  console.log(`✅ EscrowFactory App ID: ${factoryAppId}`)
  console.log(`✅ EscrowFactory Address: ${factoryAddress}`)

  // 3. Fund EscrowFactory with 1 ALGO MBR
  console.log('\nFunding EscrowFactory with MBR (1 ALGO)...')
  await algorand.send.payment({
    sender: deployer.addr,
    receiver: factoryAddress,
    amount: algos(1),
  })
  console.log(`✅ EscrowFactory successfully funded.`)

  // 4. Write to .env
  console.log('\nWriting environment variables to .env...')
  const envPath = path.join(__dirname, '../.env')
  const envContent = `ESCROW_CONTRACT_TEMPLATE_APP_ID=${escrowContractAppId}
ESCROW_FACTORY_APP_ID=${factoryAppId}
PLATFORM_TREASURY_ADDRESS=${treasury}
ARBITER_ADDRESS=${arbiter}
`
  
  fs.writeFileSync(envPath, envContent, { flag: 'w' })
  console.log(`✅ .env updated successfully.`)
  
  console.log(`\n🎉 Deployment Complete! Copy the client wrappers into server/src/contracts !`)
}

deploy().catch(console.error)
