/**
 * AlgoEscrow — Deployment Script
 *
 * Deploys EscrowContract (template) and EscrowFactory
 * Run with: npx ts-node src/deploy.ts
 *
 * For LocalNet: ALGORAND_NETWORK=localnet npx ts-node src/deploy.ts
 * For TestNet:  ALGORAND_NETWORK=testnet npx ts-node src/deploy.ts
 */

import algosdk from 'algosdk'
import { AlgorandClient, algos } from '@algorandfoundation/algokit-utils'
import { EscrowContractFactory } from './contracts/EscrowContractClient'
import { EscrowFactoryFactory } from './contracts/EscrowFactoryClient'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function deploy() {
  const network = process.env.ALGORAND_NETWORK || 'localnet'
  
  console.log(`\n🚀 AlgoEscrow Deploy Script`)
  console.log(`Network: ${network}`)
  console.log(`────────────────────────────────────────\n`)

  // Initialize Algorand client based on network
  let algorand: AlgorandClient
  let deployerAddr: string
  let deployerSigner: algosdk.TransactionSigner

  if (network === 'testnet') {
    // TestNet configuration
    const algodServer = process.env.ALGORAND_ALGOD_URL || 'https://testnet-api.algonode.cloud'
    const algodToken = process.env.ALGORAND_ALGOD_TOKEN || ''
    
    algorand = AlgorandClient.fromClients({
      algod: new algosdk.Algodv2(algodToken, algodServer, ''),
    })

    // Get deployer from mnemonic
    const mnemonic = process.env.DEPLOYER_MNEMONIC
    if (!mnemonic) {
      throw new Error('DEPLOYER_MNEMONIC not set in .env for testnet deployment')
    }
    const deployerAccount = algosdk.mnemonicToSecretKey(mnemonic)
    deployerAddr = deployerAccount.addr
    deployerSigner = algosdk.makeBasicAccountTransactionSigner(deployerAccount)
    
    console.log(`Deployer Address: ${deployerAddr}`)
    console.log(`✅ Using your wallet for deployment`)
    
    // Check deployer balance
    const accountInfo = await algorand.client.algod.accountInformation(deployerAddr).do()
    const balance = Number(accountInfo.amount) / 1_000_000
    console.log(`Deployer Balance: ${balance} ALGO`)
    
    if (balance < 1) {
      console.error(`\n❌ Insufficient balance! Need at least 1 ALGO for deployment.`)
      console.log(`Fund your account from: https://bank.testnet.algorand.network/`)
      console.log(`Address: ${deployerAddr}\n`)
      process.exit(1)
    }
  } else {
    // LocalNet configuration
    algorand = AlgorandClient.fromEnvironment()
    const kmdAccount = await algorand.account.fromKmd('unencrypted-default-wallet')
    deployerAddr = kmdAccount.addr
    deployerSigner = kmdAccount.signer
    console.log(`Deployer: ${deployerAddr} (from LocalNet KMD)`)
  }

  // Treasury and Arbiter default to deployer for demo purposes
  const treasury = deployerAddr
  const arbiter = deployerAddr

  console.log(`\n📋 Configuration:`)
  console.log(`  Treasury: ${treasury}`)
  console.log(`  Arbiter:  ${arbiter}`)
  console.log(`  Fee:      50 basis points (0.5%)\n`)

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: Deploy EscrowContract Template
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🔨 Step 1: Deploying EscrowContract (Template)...')
  
  // EscrowContract requires 8 args for createApplication
  // For template deployment, we use dummy values
  const dummySeller = deployerAddr
  const dummyItemName = new Uint8Array(Buffer.from('TEMPLATE'))
  const dummyEscrowType = 0n  // MARKETPLACE
  const dummyDeadline = BigInt(999999999)
  const dummyRequirementsHash = new Uint8Array(32) // empty hash
  const feeBps = 50n
  
  const escrowContractFactory = new EscrowContractFactory({
    algorand,
    defaultSender: deployerAddr,
    defaultSigner: deployerSigner,
  })

  const { result: escrowCreateResult, appClient: escrowAppClient } = await escrowContractFactory.send.create.createApplication({
    args: {
      seller: dummySeller,
      itemName: dummyItemName,
      escrowType: dummyEscrowType,
      deadlineRound: dummyDeadline,
      requirementsHash: dummyRequirementsHash,
      feeBps: feeBps,
      treasury: treasury,
      arbiterAddr: arbiter,
    },
  })

  const escrowContractAppId = Number(escrowCreateResult.appId)
  const escrowContractAddress = escrowCreateResult.appAddress
  
  console.log(`✅ EscrowContract Template Deployed`)
  console.log(`   App ID:  ${escrowContractAppId}`)
  console.log(`   Address: ${escrowContractAddress}`)

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Deploy EscrowFactory
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n🏭 Step 2: Deploying EscrowFactory...`)

  const factoryFactory = new EscrowFactoryFactory({
    algorand,
    defaultSender: deployerAddr,
    defaultSigner: deployerSigner,
  })

  const { result: factoryCreateResult, appClient: factoryAppClient } = await factoryFactory.send.create.createApplication({
    args: {
      treasury: treasury,
      feeBps: feeBps,
      arbiter: arbiter,
    },
  })

  const factoryAppId = Number(factoryCreateResult.appId)
  const factoryAddress = factoryCreateResult.appAddress

  console.log(`✅ EscrowFactory Deployed`)
  console.log(`   App ID:  ${factoryAppId}`)
  console.log(`   Address: ${factoryAddress}`)

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Fund Factory with MBR
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n💰 Step 3: Funding EscrowFactory with MBR (1 ALGO)...`)

  await algorand.send.payment({
    sender: deployerAddr,
    receiver: factoryAddress,
    amount: algos(1),
    signer: deployerSigner,
  })

  console.log(`✅ Factory funded successfully`)

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: Update .env file
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n📝 Step 4: Writing deployment info to .env...`)

  const envPath = path.join(__dirname, '../.env')
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

  // Update or append deployment variables
  const updateEnv = (key: string, value: string | number) => {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`)
    } else {
      envContent += `\n${key}=${value}`
    }
  }

  updateEnv('ESCROW_CONTRACT_TEMPLATE_APP_ID', escrowContractAppId)
  updateEnv('ESCROW_FACTORY_APP_ID', factoryAppId)
  updateEnv('PLATFORM_TREASURY_ADDRESS', treasury)
  updateEnv('ARBITER_ADDRESS', arbiter)

  fs.writeFileSync(envPath, envContent.trim() + '\n')
  console.log(`✅ .env updated successfully`)

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🎉 DEPLOYMENT COMPLETE!`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`\nEscrowContract Template:`)
  console.log(`  App ID:  ${escrowContractAppId}`)
  console.log(`  Address: ${escrowContractAddress}`)
  console.log(`\nEscrowFactory:`)
  console.log(`  App ID:  ${factoryAppId}`)
  console.log(`  Address: ${factoryAddress}`)
  
  if (network === 'testnet') {
    console.log(`\n🔍 View on LORA TestNet Explorer:`)
    console.log(`  Factory:  https://lora.algokit.io/testnet/application/${factoryAppId}`)
    console.log(`  Template: https://lora.algokit.io/testnet/application/${escrowContractAppId}`)
  } else {
    console.log(`\n🔍 View on LORA LocalNet Explorer:`)
    console.log(`  Factory:  https://lora.algokit.io/localnet/application/${factoryAppId}`)
    console.log(`  Template: https://lora.algokit.io/localnet/application/${escrowContractAppId}`)
  }

  console.log(`\n📦 Next Steps:`)
  console.log(`  1. Copy contracts to server:`)
  console.log(`     cp -r src/contracts/* ../server/src/contracts/`)
  console.log(`  2. Update server/.env with these App IDs`)
  console.log(`  3. Start building backend API routes\n`)
}

// Run deployment
deploy().catch((error) => {
  console.error('\n❌ Deployment failed:')
  console.error(error)
  process.exit(1)
})
