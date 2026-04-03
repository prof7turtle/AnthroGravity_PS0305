# 🚀 AlgoEscrow Backend - Setup & Testing Guide

## 📋 Prerequisites

- ✅ Node.js 18+ installed
- ✅ MongoDB running locally
- ✅ AlgoKit LocalNet running
- ✅ Smart contracts deployed (App IDs in `.env`)

---

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

The `.env` file should already be created. Verify it has:

```env
# App IDs from smart contract deployment
ESCROW_FACTORY_APP_ID=1198
ESCROW_CONTRACT_TEMPLATE_APP_ID=1197

# Algorand LocalNet
ALGORAND_NETWORK=localnet
ALGORAND_ALGOD_URL=http://localhost:4001
ALGORAND_ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

### 3. Start MongoDB

```bash
# Windows
mongod

# Or if using MongoDB as a service
net start MongoDB
```

### 4. Start AlgoKit LocalNet

```bash
algokit localnet start
```

---

## ▶️ Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

You should see:

```
✅ Connected to MongoDB
✅ Algorand Service initialized:
   Network: localnet
   Factory App ID: 1198
   Template App ID: 1197
✅ Oracle account from KMD: CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4

==================================================
🚀 AlgoEscrow API Server Running
==================================================
   Port: 5000
   Network: localnet
   Factory App ID: 1198
   Health: http://localhost:5000/api/health
==================================================
```

---

## 🧪 Testing the API

### Using cURL

#### 1. Health Check

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "AlgoEscrow API is running",
  "network": "localnet",
  "factoryAppId": "1198",
  "timestamp": "2026-04-03T16:30:00.000Z"
}
```

#### 2. Get Factory Info

```bash
curl http://localhost:5000/api/escrow/factory/info
```

Expected response:
```json
{
  "success": true,
  "data": {
    "factoryAppId": 1198,
    "templateAppId": 1197,
    "network": "localnet"
  }
}
```

#### 3. Create Escrow (Marketplace Type)

```bash
curl -X POST http://localhost:5000/api/escrow/create \
  -H "Content-Type: application/json" \
  -d "{
    \"seller\": \"CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4\",
    \"itemName\": \"iPhone 15 Pro\",
    \"escrowType\": 0,
    \"deadlineRounds\": 1000
  }"
```

Expected response:
```json
{
  "success": true,
  "message": "Transaction prepared. Sign and submit to create escrow.",
  "data": {
    "factoryAppId": 1198,
    "templateAppId": 1197,
    "seller": "CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4",
    "itemName": "iPhone 15 Pro",
    "escrowType": 0,
    "deadlineRounds": 1000,
    "requirementsHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "note": "..."
  }
}
```

#### 4. Get Escrow State (using template App ID as example)

```bash
curl http://localhost:5000/api/escrow/1197
```

#### 5. Prepare Fund Transaction

```bash
curl -X POST http://localhost:5000/api/escrow/1197/fund \
  -H "Content-Type: application/json" \
  -d "{
    \"buyer\": \"CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4\",
    \"amount\": 5000000
  }"
```

---

### Using Thunder Client / Postman

Import this collection:

```json
{
  "name": "AlgoEscrow API",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "http://localhost:5000/api/health"
    },
    {
      "name": "Factory Info",
      "method": "GET",
      "url": "http://localhost:5000/api/escrow/factory/info"
    },
    {
      "name": "Create Marketplace Escrow",
      "method": "POST",
      "url": "http://localhost:5000/api/escrow/create",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "seller": "CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4",
        "itemName": "MacBook Pro M3",
        "escrowType": 0,
        "deadlineRounds": 2000
      }
    },
    {
      "name": "Get Escrow State",
      "method": "GET",
      "url": "http://localhost:5000/api/escrow/1197"
    }
  ]
}
```

---

## 📊 API Endpoints Reference

### Escrow Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/escrow/create` | Prepare escrow creation transaction |
| `GET` | `/api/escrow/:appId` | Get escrow state |
| `GET` | `/api/escrow/:appId/status` | Get human-readable status |
| `POST` | `/api/escrow/:appId/fund` | Prepare fund transaction |
| `POST` | `/api/escrow/:appId/deliver` | Confirm delivery/submit deliverables |
| `POST` | `/api/escrow/:appId/dispute` | Raise a dispute |
| `GET` | `/api/escrow/factory/info` | Get factory information |

### Auth Endpoints (existing)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login user |

---

## 🐛 Troubleshooting

### "App IDs not set" Warning

**Problem:** Warning shows `Factory App ID: 0`

**Solution:** 
1. Deploy contracts: `cd smart-contract && npm run deploy`
2. Copy App IDs to `server/.env`

### "Failed to get KMD account"

**Problem:** Can't connect to LocalNet KMD

**Solution:**
```bash
algokit localnet start
algokit localnet status
```

### MongoDB Connection Error

**Problem:** `Failed to connect to MongoDB`

**Solution:**
```bash
# Check if MongoDB is running
mongo --eval "db.version()"

# Start MongoDB
mongod
```

### Port Already in Use

**Problem:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <process_id> /F

# Or change port in .env
PORT=5001
```

---

## 🎯 Next Steps

### 1. Test Full Escrow Flow

You can't fully test the escrow lifecycle from the backend alone because:
- Creating escrows requires calling the **factory contract** (frontend with wallet)
- Funding requires **signed atomic transactions** (frontend with wallet)
- Delivery confirmation requires **contract calls** (frontend with wallet)

The backend provides:
- ✅ Helper endpoints to prepare transactions
- ✅ State reading (get escrow info)
- ✅ Validation before contract calls
- ✅ AI verification (for freelance escrows)

### 2. Frontend Integration

Next phase:
1. Wire frontend to these API endpoints
2. Use `@txnlab/use-wallet-react` for transaction signing
3. Build EscrowDetail.tsx component
4. Add transaction flow UI

### 3. TestNet Deployment

For TestNet:
1. Deploy contracts to TestNet
2. Update `server/.env` with TestNet App IDs
3. Set `ALGORAND_NETWORK=testnet`
4. Add `ESCROW_MNEMONIC` for backend signing

---

## 📝 Example Flow

### Creating & Funding an Escrow

1. **Frontend**: User clicks "Buy Now"
2. **Backend**: `POST /api/escrow/create` → Returns transaction params
3. **Frontend**: Build & sign factory.createEscrow() transaction
4. **Blockchain**: New escrow contract deployed, get App ID
5. **Backend**: `POST /api/escrow/:id/fund` → Returns fund params
6. **Frontend**: Build & sign atomic group [Payment, AppCall(fund)]
7. **Blockchain**: Escrow funded, state → FUNDED
8. **Backend**: `GET /api/escrow/:id/status` → Show status to user

---

## ✅ Success Indicators

Your backend is working if:

- [x] Server starts without errors
- [x] Health check returns `200 OK`
- [x] Factory info shows correct App IDs
- [x] Create escrow endpoint returns transaction params
- [x] Get escrow state returns contract global state
- [x] MongoDB connection established

---

**Need help?** Check the logs for detailed error messages. The backend is now ready for frontend integration! 🎉
