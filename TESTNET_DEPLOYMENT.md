# 🚀 Quick TestNet Deployment Guide

## Step 1: Get TestNet Wallet & ALGO

1. **Create a new Algorand wallet** (Pera Wallet recommended):
   - Download: https://perawallet.app/
   - Create new account
   - Copy your wallet address

2. **Export your mnemonic** (25-word recovery phrase):
   - In Pera: Settings → Account → Show Passphrase
   - **⚠️ Keep this private! Never share or commit to git**

3. **Get TestNet ALGO:**
   - Visit: https://bank.testnet.algorand.network/
   - Paste your wallet address
   - Click "Dispense"
   - Wait ~5 seconds for confirmation

## Step 2: Configure for TestNet

Edit `smart-contract/.env`:

```env
# Change this line:
ALGORAND_NETWORK=testnet

# Uncomment these lines:
ALGORAND_ALGOD_URL=https://testnet-api.algonode.cloud
ALGORAND_ALGOD_TOKEN=
ALGORAND_INDEXER_URL=https://testnet-idx.algonode.cloud

# Add your mnemonic (replace with your actual 25 words):
DEPLOYER_MNEMONIC=word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24 word25
```

**Example (DO NOT USE THIS MNEMONIC - it's just an example):**
```env
DEPLOYER_MNEMONIC=abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest
```

## Step 3: Deploy to TestNet

```bash
cd X:\ignition\AnthroGravity_PS0305\smart-contract

npm run deploy
```

## Step 4: Verify Deployment

You should see output like:

```
🎉 DEPLOYMENT COMPLETE!
════════════════════════════════════════════════════════════

EscrowContract Template:
  App ID:  XXXXX
  Address: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

EscrowFactory:
  App ID:  YYYYY
  Address: YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY

🔍 View on LORA TestNet Explorer:
  Factory:  https://lora.algokit.io/testnet/application/YYYYY
  Template: https://lora.algokit.io/testnet/application/XXXXX
```

Click the LORA links to verify your contracts are live!

## Step 5: Update Backend .env

Copy the App IDs to your backend:

```bash
cd X:\ignition\AnthroGravity_PS0305\server
```

Create/edit `server/.env`:

```env
ALGORAND_NETWORK=testnet
ALGORAND_ALGOD_URL=https://testnet-api.algonode.cloud
ALGORAND_INDEXER_URL=https://testnet-idx.algonode.cloud

# Copy these from smart-contract/.env after deployment
ESCROW_CONTRACT_TEMPLATE_APP_ID=XXXXX
ESCROW_FACTORY_APP_ID=YYYYY
PLATFORM_TREASURY_ADDRESS=<your_wallet_address>
ARBITER_ADDRESS=<your_wallet_address>
PLATFORM_FEE_BPS=50

# Other configs
MONGODB_URI=mongodb://localhost:27017/algoescrow
JWT_SECRET=your-secret-key-here
PORT=3000
```

## Step 6: Copy Contract Clients to Server

Windows:
```cmd
xcopy /E /I smart-contract\src\contracts server\src\contracts
```

PowerShell:
```powershell
Copy-Item -Recurse smart-contract\src\contracts server\src\contracts
```

## ✅ Success Checklist

- [ ] TestNet wallet created
- [ ] Mnemonic safely stored (NOT in git)
- [ ] TestNet ALGO received (~10 ALGO)
- [ ] `.env` updated with network=testnet and mnemonic
- [ ] `npm run deploy` completed successfully
- [ ] Both App IDs visible in output
- [ ] Contracts verified on LORA TestNet Explorer
- [ ] App IDs copied to `server/.env`
- [ ] Contract clients copied to `server/src/contracts/`

## 🎯 What's Next?

After successful TestNet deployment:

1. **Backend Development:**
   - Install AlgoKit Utils in server: `npm install @algorandfoundation/algokit-utils algosdk`
   - Build escrow API routes
   - Implement transaction building
   - Add AI verification service

2. **Frontend Integration:**
   - Wire WalletProvider wrapper
   - Connect contract calls
   - Build transaction signing flows
   - Test end-to-end on TestNet

3. **Testing:**
   - Create test escrow on TestNet
   - Test full lifecycle (create → fund → deliver → complete)
   - Test dispute flow
   - Verify on LORA Explorer

## 🆘 Troubleshooting

### "Insufficient balance" error
- Make sure you dispensed TestNet ALGO
- Check balance: https://testnet.algoexplorer.io/address/YOUR_ADDRESS

### "Invalid mnemonic" error
- Verify you have exactly 25 words
- Check for extra spaces or line breaks
- Mnemonic should be in quotes if it contains spaces

### Deployment succeeds but can't find contract on LORA
- Wait 5-10 seconds for indexer to catch up
- Refresh the LORA page
- Check you're using `/testnet/` in the URL, not `/localnet/`

---

**Quick Command Summary:**

```bash
# Get TestNet ALGO
https://bank.testnet.algorand.network/

# Deploy to TestNet
cd smart-contract
npm run deploy

# Copy contracts to server
xcopy /E /I src\contracts ..\server\src\contracts
```

**Important URLs:**
- TestNet Dispenser: https://bank.testnet.algorand.network/
- LORA Explorer: https://lora.algokit.io/testnet
- Pera Wallet: https://perawallet.app/
