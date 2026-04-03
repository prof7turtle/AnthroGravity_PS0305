# AlgoEscrow Backend API

Backend server for AlgoEscrow - Escrow-as-a-Service on Algorand

## 🏗️ Architecture

```
server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/
│   │   ├── auth.ts           # Authentication routes
│   │   └── escrow.routes.ts  # Escrow API routes
│   ├── services/
│   │   ├── algorand.service.ts  # Blockchain interaction layer
│   │   └── ai.service.ts        # AI verification (Claude API)
│   ├── types/
│   │   └── escrow.types.ts   # TypeScript interfaces
│   ├── models/
│   │   └── User.ts           # MongoDB models
│   └── contracts/            # (Copy typed clients here)
├── .env                      # Environment configuration
├── package.json
└── TESTING_GUIDE.md          # Full testing documentation
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```env
ESCROW_FACTORY_APP_ID=1198
ESCROW_CONTRACT_TEMPLATE_APP_ID=1197
ALGORAND_NETWORK=localnet
```

### 3. Start MongoDB

```bash
mongod
```

### 4. Start LocalNet

```bash
algokit localnet start
```

### 5. Run Server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Health & Info

- `GET /api/health` - Server health check
- `GET /api/escrow/factory/info` - Factory App IDs

### Escrow Operations

- `POST /api/escrow/create` - Prepare escrow creation
- `GET /api/escrow/:appId` - Get escrow state
- `GET /api/escrow/:appId/status` - Get readable status
- `POST /api/escrow/:appId/fund` - Prepare fund transaction
- `POST /api/escrow/:appId/deliver` - Submit deliverables
- `POST /api/escrow/:appId/dispute` - Raise dispute

### Authentication

- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection | `mongodb://127.0.0.1:27017/algoescrow` |
| `ALGORAND_NETWORK` | Network (localnet/testnet) | `localnet` |
| `ESCROW_FACTORY_APP_ID` | Deployed factory App ID | `1198` |
| `ESCROW_CONTRACT_TEMPLATE_APP_ID` | Template App ID | `1197` |
| `CLAUDE_API_KEY` | For AI verification | Optional |

## 🧪 Testing

### Quick Test

```bash
npx ts-node test-api.ts
```

### Manual Testing

```bash
# Health check
curl http://localhost:5000/api/health

# Factory info
curl http://localhost:5000/api/escrow/factory/info

# Create escrow
curl -X POST http://localhost:5000/api/escrow/create \
  -H "Content-Type: application/json" \
  -d '{"seller":"CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4","itemName":"Test","escrowType":0,"deadlineRounds":1000}'
```

See `TESTING_GUIDE.md` for full testing documentation.

## 🏛️ Services

### Algorand Service (`algorand.service.ts`)

Handles all blockchain interactions:
- Initialize Algod/Indexer clients
- Read escrow global state
- Parse contract state
- Build unsigned transactions
- Submit transactions

### AI Service (`ai.service.ts`)

Handles freelance deliverable verification:
- Claude API integration
- Score deliverables (0-100)
- Generate reasoning

## 📊 State Machine

```
CREATED (0) → FUNDED (1) → DELIVERED (2) → COMPLETED (3)
                ↓
             DISPUTED (4) → COMPLETED (3) or REFUNDED (5)
                ↓
             EXPIRED (6) → REFUNDED (5)
```

## 🔐 Security Notes

- Never commit `.env` to git
- Use separate wallets for TestNet/MainNet
- Oracle mnemonic required for delivery confirmations
- CORS configured for frontend origin

## 📝 Development Notes

### Adding New Routes

1. Create route file in `src/routes/`
2. Import in `src/index.ts`
3. Mount with `app.use('/api/path', router)`

### Adding New Services

1. Create service file in `src/services/`
2. Export singleton instance
3. Import in routes as needed

## 🐛 Common Issues

**"App IDs not set"**
- Deploy contracts first: `cd ../smart-contract && npm run deploy`
- Update `.env` with App IDs

**"Failed to connect to MongoDB"**
- Start MongoDB: `mongod`

**"Failed to get KMD account"**
- Start LocalNet: `algokit localnet start`

## 🎯 Next Steps

1. ✅ Backend API ready
2. ⏳ Wire frontend to API endpoints
3. ⏳ Add transaction signing in UI
4. ⏳ Build EscrowDetail.tsx component
5. ⏳ Test full escrow lifecycle

## 📚 Resources

- [AlgoKit Docs](https://github.com/algorandfoundation/algokit-cli)
- [Algorand SDK](https://developer.algorand.org/)
- [LORA Explorer](https://lora.algokit.io/)

---

**Status:** ✅ Phase 2 Backend Complete  
**Last Updated:** 2026-04-03
