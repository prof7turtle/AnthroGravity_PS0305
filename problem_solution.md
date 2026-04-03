# AlgoEscrow — Agent Build Instructions

> This file is the complete specification for an AI coding agent (VibeKit, Claude Code, Cursor, Copilot)
> to build AlgoEscrow from scratch. Read every section before writing any code.
> Follow the sequence strictly. Do not skip phases.

---

## 0. Project Identity

| Field | Value |
|---|---|
| **Project Name** | AlgoEscrow |
| **Tagline** | Escrow as a Service — on Algorand |
| **Vision** | Escrow.com rebuilt on Algorand: trustless, instant, programmable |
| **Hackathon Track** | Blockchain — Algorand Sponsored |
| **Problem Statement ID** | PS0305 |
| **Team Size** | 3 members |
| **Time Constraint** | 24 hours |

---

## 1. Problem Statement (Original — PS0305)

> In digital marketplaces, transactions between buyers and sellers often suffer from trust issues.
> Buyers fear paying upfront without receiving the promised product or service, while sellers worry
> about delivering without guaranteed payment. Traditional systems rely on intermediaries or manual
> dispute resolution, which can be slow, opaque, and inefficient. This creates friction in
> peer-to-peer commerce and limits participation in decentralized or trust-minimized environments.
>
> An escrow-based system can solve this by temporarily locking funds until predefined conditions —
> such as delivery confirmation — are met. By enforcing structured state transitions, such a system
> ensures fairness, transparency, and security for both parties.
>
> **Design and develop an escrow-based checkout system that locks funds during a transaction,
> tracks delivery status, and automatically releases or refunds funds based on predefined conditions,
> ensuring a secure and trust-minimized exchange between buyer and seller.**

### Core Requirements Extracted
1. Lock funds during a transaction (neither party can access unilaterally)
2. Track delivery or completion status (state machine)
3. Auto-release funds to seller when conditions are met
4. Auto-refund buyer when conditions fail or deadline passes
5. Trustless — no human intermediary in the flow

---

## 2. Our Solution — AlgoEscrow

### What We Are Building
AlgoEscrow is an **Escrow-as-a-Service (EaaS) platform** built entirely on Algorand smart contracts.
We are NOT building a single escrow app. We are building **escrow infrastructure** that:

1. **Any marketplace can integrate** via our REST API + npm SDK (B2B layer)
2. **Users can use directly** via our web platform (B2C layer)
3. **Supports three escrow modes** — Marketplace, Peer-to-Peer, and Freelance

### The Escrow.com Comparison (Pitch Frame)
- Escrow.com: 0.89–3.25% fee, 3–7 day settlement, centralized custodian, opaque
- AlgoEscrow: 0.5% fee, 2.8-second finality, trustless smart contract vault, fully on-chain

### Three Escrow Modes

#### Mode 1 — Marketplace Escrow
For e-commerce: Buyer pays → funds locked → seller ships → delivery confirmed via oracle → funds released.
Used by our Dummy Marketplace (ShopDemo) as a demo integration.

#### Mode 2 — Direct P2P Escrow
Two individuals agree on a deal → buyer funds escrow → seller delivers → mutual confirmation → release.
No third party ever. Dispute goes to arbitration.

#### Mode 3 — Freelance Escrow (AI-Verified)
Client posts requirements → freelancer submits deliverables (GitHub URL, description, screenshots) →
AI agent (Claude API) scores deliverables against requirements → auto-release if score ≥ threshold →
dispute mode if score < threshold. Verdict stored on-chain.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ALGORAND BLOCKCHAIN                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              EscrowFactory Contract (App ID: permanent)     │    │
│  │  createMarketplaceEscrow()  → deploys EscrowContract        │    │
│  │  createP2PEscrow()          → deploys EscrowContract        │    │
│  │  createFreelanceEscrow()    → deploys EscrowContract        │    │
│  │  getAllEscrows()             → indexed list                  │    │
│  │  platformTreasury           → GlobalState address           │    │
│  └──────────────────────┬──────────────────────────────────────┘    │
│                         │ inner transaction: deploys child           │
│  ┌──────────────────────▼──────────────────────────────────────┐    │
│  │              EscrowContract (one per transaction)           │    │
│  │  GlobalState: buyer, seller, amount, state, deadline,       │    │
│  │               escrow_type, item_name, platform_fee_bps,     │    │
│  │               requirements_hash, deliverables_hash,         │    │
│  │               ai_score, arbiter                             │    │
│  │                                                             │    │
│  │  Methods:                                                   │    │
│  │  fund()               confirmDelivery()   requestRefund()  │    │
│  │  raiseDispute()       submitDeliverables() aiVerdict()     │    │
│  │  arbitrate()          getDetails()         collectFee()    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ AlgoKit Utils TypeScript SDK
                         │ Algorand Indexer (state polling)
┌────────────────────────▼─────────────────────────────────────────────┐
│                    AlgoEscrow Backend (Node.js + Express)            │
│                                                                      │
│  REST API Endpoints:                                                 │
│  POST   /api/escrow/create          → deploy EscrowContract         │
│  POST   /api/escrow/:id/fund        → build + return fund txn       │
│  POST   /api/escrow/:id/deliver     → oracle: confirm delivery       │
│  POST   /api/escrow/:id/dispute     → raise dispute                 │
│  POST   /api/escrow/:id/submit-work → freelancer submits work       │
│  POST   /api/escrow/:id/ai-verify   → trigger AI verification       │
│  POST   /api/escrow/:id/arbitrate   → arbiter resolves dispute      │
│  GET    /api/escrow/:id             → full escrow state + history   │
│  GET    /api/escrow/list/:address   → all escrows for an address    │
│                                                                      │
│  Webhook Engine:                                                     │
│  On every state change → POST to marketplace's registered webhook   │
│  Payload: { escrowId, appId, newState, txId, timestamp }            │
│                                                                      │
│  AI Layer (Claude API / OpenAI):                                     │
│  Input:  requirements (from escrow creation) + deliverables          │
│  Output: { score: 0-100, matched: [], gaps: [], verdict: string }   │
│  Action: if score >= 75 → call aiVerdict(true) on contract          │
│          if score <  75 → call aiVerdict(false) → dispute mode      │
└──────────┬───────────────────────────────┬───────────────────────────┘
           │                               │
┌──────────▼───────────┐       ┌───────────▼──────────────────────────┐
│  AlgoEscrow Frontend  │       │  @algoescrow/sdk (npm package)       │
│  (React + Vite + TS)  │       │                                      │
│                       │       │  import { AlgoEscrow } from          │
│  Pages:               │       │    '@algoescrow/sdk'                 │
│  / → Landing page     │       │                                      │
│  /create → New escrow │       │  AlgoEscrow.create({...})            │
│  /escrow/:id → Detail │       │  AlgoEscrow.fund(id, amount)         │
│  /dashboard → My list │       │  AlgoEscrow.confirm(id)              │
│  /freelance → Gig UI  │       │  AlgoEscrow.status(id)               │
│  /marketplace → Demo  │       │                                      │
│  /dispute/:id         │       │  Used by ShopDemo (dummy mktplace)   │
└───────────────────────┘       └──────────────────────────────────────┘
                                          │
                               ┌──────────▼──────────────────────────┐
                               │  ShopDemo — Dummy Marketplace       │
                               │  (React app, separate port)         │
                               │  Shows product listing → checkout   │
                               │  → escrow funding → delivery        │
                               │  → fund release — full e2e demo     │
                               └─────────────────────────────────────┘
```

---

## 4. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Smart Contracts | Algorand TypeScript (AlgoKit 3.0) | Same lang as frontend, type-safe, AlgoKit native |
| Contract Testing | algorand-typescript-testing + vitest | Unit test all state transitions locally |
| Local Blockchain | AlgoKit LocalNet (Docker) | Free, fast, no testnet ALGO needed for dev |
| Contract Deploy | `algokit project deploy testnet` | Auto-generates TypedAppClient |
| Backend | Node.js + Express + TypeScript | MERN-compatible, fast to build |
| Blockchain SDK | @algorandfoundation/algokit-utils | Official TS utility library |
| AI Verification | Anthropic Claude API (claude-3-5-haiku) | Fast, cheap, structured JSON output |
| Frontend | React + Vite + TypeScript | AlgoKit official template |
| Styling | Tailwind CSS + DaisyUI | Fast UI, pre-built components |
| Wallet | @txnlab/use-wallet-react | Supports Pera + Defly + Exodus |
| Chain Explorer | LORA (algokit localnet explore) | Visual on-chain state debugging |
| AI Dev Agent | VibeKit | AI-assisted contract + code generation |
| Testnet ALGO | AlgoKit Dispenser | Free faucet |
| Frontend Deploy | Vercel | 1-command deploy for live demo URL |
| Dummy Marketplace | React + Vite (separate app) | Uses @algoescrow/sdk |

---

## 5. Project File Structure

```
algoescrow/                             ← monorepo root
├── agent.md                            ← THIS FILE
├── package.json                        ← workspace root
│
├── contracts/                          ← Algorand TypeScript smart contracts
│   ├── package.json
│   ├── tsconfig.json
│   ├── algokit.toml
│   ├── src/
│   │   ├── escrow_factory.algo.ts      ← Factory contract (creates child escrows)
│   │   ├── escrow_contract.algo.ts     ← Core escrow logic (one per transaction)
│   │   └── constants.ts               ← Shared enums: EscrowState, EscrowType
│   └── tests/
│       ├── escrow_factory.test.ts
│       └── escrow_contract.test.ts
│
├── backend/                            ← Node.js + Express API
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                   ← Express app entry
│   │   ├── routes/
│   │   │   ├── escrow.routes.ts       ← All /api/escrow/* routes
│   │   │   └── webhook.routes.ts      ← Webhook registration routes
│   │   ├── services/
│   │   │   ├── algorand.service.ts    ← AlgoKit Utils wrapper
│   │   │   ├── ai.service.ts          ← Claude API integration
│   │   │   ├── webhook.service.ts     ← Webhook dispatcher
│   │   │   └── indexer.service.ts     ← Algorand Indexer polling
│   │   ├── contracts/                 ← Auto-generated TypedAppClients
│   │   │   ├── EscrowFactoryClient.ts
│   │   │   └── EscrowContractClient.ts
│   │   └── types/
│   │       └── escrow.types.ts        ← Shared TypeScript interfaces
│   └── .env.example
│
├── frontend/                           ← React + Vite main platform
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx            ← Hero, features, how it works
│   │   │   ├── CreateEscrow.tsx       ← Form: type, parties, amount, deadline
│   │   │   ├── EscrowDetail.tsx       ← Live state machine + action buttons
│   │   │   ├── Dashboard.tsx          ← All escrows for connected wallet
│   │   │   ├── FreelanceEscrow.tsx    ← Freelance-specific flow
│   │   │   └── Dispute.tsx            ← Dispute resolution UI
│   │   ├── components/
│   │   │   ├── StateMachineBadge.tsx  ← Visual state progress indicator
│   │   │   ├── WalletConnect.tsx      ← use-wallet integration
│   │   │   ├── EscrowCard.tsx         ← Card for dashboard listing
│   │   │   ├── AIVerdictPanel.tsx     ← Shows AI score + reasoning
│   │   │   └── TxnExplorerLink.tsx    ← Links to LORA for every txn
│   │   ├── hooks/
│   │   │   ├── useEscrow.ts           ← Contract interaction hook
│   │   │   └── useAlgorand.ts         ← AlgoKit Utils setup hook
│   │   └── contracts/                 ← Copied from contracts/dist after deploy
│   └── index.html
│
├── sdk/                                ← @algoescrow/sdk npm package
│   ├── package.json
│   ├── src/
│   │   ├── index.ts                   ← Public API exports
│   │   ├── AlgoEscrow.ts              ← Main SDK class
│   │   └── types.ts
│   └── README.md
│
└── shopdemo/                           ← Dummy Marketplace (separate React app)
    ├── package.json
    ├── src/
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── ProductListing.tsx     ← Browse products
    │   │   ├── Checkout.tsx           ← Uses @algoescrow/sdk to create escrow
    │   │   ├── OrderStatus.tsx        ← Polls escrow state via SDK
    │   │   └── SellerDashboard.tsx    ← Seller confirms shipment
    └── index.html
```

---

## 6. Smart Contracts — Full Specification

> This is the most critical section. Read completely before writing any contract code.

### 6.1 Overview — Why Two Contracts

The system uses two Algorand TypeScript smart contracts in a **Factory Pattern**:

- **EscrowFactory**: Deployed once. Acts as the registry and deployer of individual escrow contracts.
  Any marketplace or user interacts with the factory to create new escrows.
- **EscrowContract**: Deployed per transaction. Each deal has its own isolated contract with
  its own Algorand address (the escrow vault). Funds live in this address.

This pattern means:
- Every escrow is independently auditable by its App ID
- No single contract holds all funds (reduces blast radius of any bug)
- Judges can inspect individual escrow state on LORA by App ID

---

### 6.2 EscrowState Enum (State Machine)

Every EscrowContract transitions through these states in order:

```typescript
enum EscrowState {
  CREATED    = 0,  // Contract deployed, waiting for buyer to fund
  FUNDED     = 1,  // Buyer has deposited funds, locked in contract address
  DELIVERED  = 2,  // Delivery/completion confirmed (by oracle, buyer, or AI)
  COMPLETED  = 3,  // Funds released to seller via inner transaction
  DISPUTED   = 4,  // Either party raised a dispute, awaiting arbitration
  REFUNDED   = 5,  // Funds returned to buyer via inner transaction
  EXPIRED    = 6,  // Deadline passed, no action taken → refund available
}
```

State transition rules (enforced by contract assertions):
```
CREATED   → FUNDED     : buyer calls fund() with attached payment txn
FUNDED    → DELIVERED  : buyer calls confirmDelivery() OR oracle calls confirmDelivery()
                         OR AI calls aiVerdict(true)
FUNDED    → DISPUTED   : buyer calls raiseDispute() within deadline
FUNDED    → EXPIRED    : current_round > deadline_round (checked on any call)
DELIVERED → COMPLETED  : auto-transition inside confirmDelivery() via inner txn
DISPUTED  → COMPLETED  : arbiter calls arbitrate(releaseToSeller=true)
DISPUTED  → REFUNDED   : arbiter calls arbitrate(releaseToSeller=false)
EXPIRED   → REFUNDED   : buyer calls requestRefund() after deadline
```

**No state can go backwards. All transitions checked with assert statements.**

---

### 6.3 EscrowType Enum

```typescript
enum EscrowType {
  MARKETPLACE = 0,  // Physical goods, oracle-confirmed delivery
  P2P         = 1,  // Direct deal, buyer manually confirms
  FREELANCE   = 2,  // Digital work, AI-verified completion
}
```

---

### 6.4 EscrowFactory Contract

**File:** `contracts/src/escrow_factory.algo.ts`

**Purpose:**
- Single entry point for all escrow creation
- Stores platform treasury address (receives fees)
- Maintains count of all created escrows
- Emits creation events for indexer tracking

**Global State Variables:**
```typescript
platform_treasury: GlobalState<Address>  // AlgoEscrow fee wallet
total_escrows: GlobalState<uint64>        // Counter of all escrows created
platform_fee_bps: GlobalState<uint64>    // Default fee in basis points (50 = 0.5%)
```

**ABI Methods:**

```typescript
// Called once at deployment by AlgoEscrow team
@abimethod({ onCreate: 'require' })
createApplication(treasury: Address, feeBps: uint64): void

// Core factory method — deploys a new EscrowContract
// Returns the new contract's App ID
// escrowType: 0=MARKETPLACE, 1=P2P, 2=FREELANCE
// requirementsHash: SHA256 of requirements text (for freelance, else empty string)
// deadlineRounds: number of Algorand rounds until escrow expires (~3.3 sec each)
@abimethod
createEscrow(
  seller: Address,
  itemName: string,
  escrowType: uint64,
  deadlineRounds: uint64,
  requirementsHash: bytes,
): uint64  // returns new App ID

// Read-only: get platform config
@abimethod({ readonly: true })
getPlatformConfig(): [Address, uint64, uint64]  // treasury, feeBps, totalEscrows

// Admin: update fee (only creator)
@abimethod
updateFee(newFeeBps: uint64): void
```

**Implementation Notes:**
- `createEscrow` uses an **inner transaction** of type `appl` (application create) to deploy a new EscrowContract
- After deploying, factory sends a MBR (Minimum Balance Requirement) funding inner txn to the new contract
- Factory increments `total_escrows` counter
- New contract's App ID is returned to caller

---

### 6.5 EscrowContract — Full Method Specifications

**File:** `contracts/src/escrow_contract.algo.ts`

**Purpose:**
- One deployed per transaction/deal
- The contract's own Algorand address IS the escrow vault
- All funds are held at this address
- All business logic lives here

**Global State Variables:**
```typescript
// Parties
buyer:          GlobalState<Address>    // Set on first fund() call
seller:         GlobalState<Address>    // Set at creation by factory

// Deal metadata
item_name:      GlobalState<bytes>      // Product/service name
escrow_type:    GlobalState<uint64>     // EscrowType enum (0/1/2)
amount:         GlobalState<uint64>     // Amount in microALGO locked

// State machine
state:          GlobalState<uint64>     // EscrowState enum (0–6)
created_round:  GlobalState<uint64>     // Algorand round at creation
deadline_round: GlobalState<uint64>     // Round after which escrow expires

// Fee config (copied from factory at creation)
platform_fee_bps:    GlobalState<uint64>   // e.g., 50 = 0.5%
platform_treasury:   GlobalState<Address>  // AlgoEscrow fee wallet

// Freelance-specific
requirements_hash:   GlobalState<bytes>    // SHA256 of original requirements
deliverables_hash:   GlobalState<bytes>    // SHA256 of submitted deliverables
ai_score:            GlobalState<uint64>   // AI verification score 0–100
ai_verdict_note:     GlobalState<bytes>    // IPFS hash or summary of AI reasoning

// Dispute
arbiter:             GlobalState<Address>  // AlgoEscrow arbiter address (from factory)
dispute_raised_by:   GlobalState<Address>  // Who raised the dispute

// Tracking
last_txn_id:         GlobalState<bytes>    // Most recent txn that changed state
```

---

**Method 1: `fund()`**

```
Role:     Called by buyer to lock funds in the escrow vault
Who:      Buyer (any address — becomes the buyer on first call)
When:     state == CREATED
Inputs:   Payment transaction in the same atomic group (gtxn[0])

Preconditions (assert all):
  - state == CREATED
  - Gtxn[0].TypeEnum == TxnType.Payment
  - Gtxn[0].Receiver == Global.currentApplicationAddress  ← escrow vault
  - Gtxn[0].Sender == Txn.Sender  ← buyer is paying
  - Gtxn[0].Amount > 0
  - Global.round <= deadline_round  ← not expired

Actions:
  - buyer.value = Txn.Sender
  - amount.value = Gtxn[0].Amount
  - state.value = EscrowState.FUNDED

Atomic group structure (built by frontend/backend):
  Txn 0: Payment (buyer → escrowContractAddress, amount in microALGO)
  Txn 1: AppCall → fund() (buyer signs both)
```

---

**Method 2: `confirmDelivery()`**

```
Role:     Confirms that goods/service were delivered; triggers auto-release
Who:      Buyer (Mode 1 + 2) OR backend oracle address (Mode 1 Marketplace)
When:     state == FUNDED
Inputs:   none

Preconditions:
  - state == FUNDED
  - Txn.Sender == buyer.value OR Txn.Sender == Global.creatorAddress (oracle)

Actions:
  1. Calculate platform fee:
       fee_amount = (amount.value * platform_fee_bps.value) / 10000
       seller_amount = amount.value - fee_amount

  2. Inner Transaction A — pay seller:
       itxn.Payment({ receiver: seller.value, amount: seller_amount })

  3. Inner Transaction B — collect platform fee:
       itxn.Payment({ receiver: platform_treasury.value, amount: fee_amount })

  4. state.value = EscrowState.COMPLETED
  5. last_txn_id.value = Txn.TxID

Output: Emits ARC-28 event { appId, state: COMPLETED, seller, amount, fee }
```

---

**Method 3: `requestRefund()`**

```
Role:     Returns locked funds to buyer (after deadline or if seller defaults)
Who:      Buyer only
When:     state == FUNDED AND (Global.round > deadline_round OR state == EXPIRED)

Preconditions:
  - state == FUNDED
  - Txn.Sender == buyer.value
  - Global.round > deadline_round  ← deadline must have passed

Actions:
  1. Inner Transaction — refund buyer:
       itxn.Payment({ receiver: buyer.value, amount: amount.value })
  2. state.value = EscrowState.REFUNDED

Note: No platform fee on refunds. Buyer gets full amount back.
```

---

**Method 4: `raiseDispute()`**

```
Role:     Pauses the escrow and escalates to arbitration
Who:      Buyer (within deadline, after funding)
When:     state == FUNDED AND Global.round <= deadline_round

Preconditions:
  - state == FUNDED
  - Txn.Sender == buyer.value
  - Global.round <= deadline_round

Actions:
  - state.value = EscrowState.DISPUTED
  - dispute_raised_by.value = Txn.Sender

Note: Once disputed, only arbiter can resolve. Funds remain locked.
```

---

**Method 5: `arbitrate(releaseToSeller: bool)`**

```
Role:     Final resolution of a dispute by the arbiter
Who:      Arbiter address only (set at contract creation, controlled by AlgoEscrow)
When:     state == DISPUTED

Preconditions:
  - state == DISPUTED
  - Txn.Sender == arbiter.value

If releaseToSeller == true:
  Actions:
    - Calculate fee, pay seller (seller_amount), pay treasury (fee)
    - state.value = EscrowState.COMPLETED

If releaseToSeller == false:
  Actions:
    - itxn.Payment({ receiver: buyer.value, amount: amount.value })
    - state.value = EscrowState.REFUNDED
    - No platform fee on dispute-resolved refunds

Note: Arbiter is a 3-of-5 multisig controlled by AlgoEscrow team in production.
      For hackathon: single arbiter address controlled by backend wallet.
```

---

**Method 6: `submitDeliverables(deliverablesHash: bytes)`**

```
Role:     Freelancer submits proof of work (hash of deliverables package)
Who:      Seller (freelancer) only
When:     state == FUNDED AND escrow_type == FREELANCE

Preconditions:
  - state == FUNDED
  - Txn.Sender == seller.value
  - escrow_type.value == EscrowType.FREELANCE

Actions:
  - deliverables_hash.value = deliverablesHash
  (Does NOT change state — state stays FUNDED until AI verdict)

Note: Backend detects this state change via Indexer and triggers AI verification.
```

---

**Method 7: `aiVerdict(approved: bool, score: uint64, verdictNote: bytes)`**

```
Role:     Records AI verification result and auto-releases or disputes
Who:      AlgoEscrow backend oracle address only
When:     state == FUNDED AND escrow_type == FREELANCE AND deliverables_hash is set

Preconditions:
  - Txn.Sender == Global.creatorAddress  ← only our backend can call this
  - state == FUNDED
  - escrow_type.value == EscrowType.FREELANCE
  - deliverables_hash.value != ""  ← work must have been submitted

If approved == true (score >= 75):
  Actions:
    - ai_score.value = score
    - ai_verdict_note.value = verdictNote
    - Calculate fee, pay seller, pay treasury
    - state.value = EscrowState.COMPLETED

If approved == false (score < 75):
  Actions:
    - ai_score.value = score
    - ai_verdict_note.value = verdictNote
    - state.value = EscrowState.DISPUTED  ← human arbiter reviews
```

---

**Method 8: `getDetails()` (read-only)**

```
Role:     Returns complete escrow state for frontend/API polling
Who:      Anyone (readonly)
Returns:  Tuple of all global state variables

Return type:
  [
    buyer: Address,
    seller: Address,
    amount: uint64,
    state: uint64,
    escrowType: uint64,
    itemName: string,
    deadlineRound: uint64,
    currentRound: uint64,
    aiScore: uint64,
    platformFeeBps: uint64
  ]
```

---

### 6.6 Smart Contract Security Rules

All of these must be enforced with `assert` statements — never trust caller input:

```
1. State gate:      Every method asserts required state at entry
2. Sender gate:     Every method asserts authorized sender (buyer/seller/oracle/arbiter)
3. Deadline gate:   fund() and raiseDispute() assert Global.round <= deadline_round
4. Refund gate:     requestRefund() asserts Global.round > deadline_round
5. Amount gate:     fund() asserts payment amount > 0 and matches expected amount
6. Atomic gate:     fund() uses Gtxn checks to verify payment is in same atomic group
7. Immutability:    Once COMPLETED or REFUNDED, no method can change state (final states)
8. No re-entry:     Algorand AVM is single-threaded — no reentrancy attacks possible
9. Oracle-only:     aiVerdict() and oracle confirmDelivery() check Global.creatorAddress
```

---

### 6.7 Smart Contract Tests (Write All These)

**File:** `contracts/tests/escrow_contract.test.ts`

```typescript
// Happy Path Tests
test('fund: buyer locks correct amount, state becomes FUNDED')
test('confirmDelivery: seller receives amount minus fee, state becomes COMPLETED')
test('confirmDelivery: platform treasury receives correct fee')
test('requestRefund: buyer gets full refund after deadline, state becomes REFUNDED')

// Freelance Tests
test('submitDeliverables: hash stored, state stays FUNDED')
test('aiVerdict true: funds released to seller, score stored on-chain')
test('aiVerdict false: state becomes DISPUTED, score stored on-chain')

// Dispute Tests
test('raiseDispute: state becomes DISPUTED')
test('arbitrate(true): seller paid, state COMPLETED')
test('arbitrate(false): buyer refunded, state REFUNDED')

// Security / Edge Case Tests
test('fund: fails if called twice (state not CREATED)')
test('fund: fails if payment receiver is not contract address')
test('confirmDelivery: fails if caller is not buyer or oracle')
test('raiseDispute: fails after deadline')
test('requestRefund: fails before deadline')
test('aiVerdict: fails if caller is not oracle address')
test('arbitrate: fails if caller is not arbiter')
test('all methods: fail if contract is COMPLETED')
test('all methods: fail if contract is REFUNDED')
```

---

## 7. Backend API — Full Specification

**File:** `backend/src/routes/escrow.routes.ts`

### POST `/api/escrow/create`
```typescript
Body: {
  seller: string,         // Algorand address
  itemName: string,
  escrowType: 0 | 1 | 2, // MARKETPLACE | P2P | FREELANCE
  deadlineHours: number,  // Converted to rounds: hours * 3600 / 3.3
  amount: number,         // in ALGO (converted to microALGO)
  requirements?: string,  // Freelance only: project requirements text
  webhookUrl?: string,    // Marketplace integration: callback URL
}
Response: {
  appId: number,          // Algorand App ID of deployed EscrowContract
  escrowAddress: string,  // Contract's Algorand address (the vault)
  txId: string,           // Factory creation transaction ID
  loraUrl: string,        // https://lora.algokit.io/testnet/application/{appId}
}
```

### POST `/api/escrow/:id/fund`
```typescript
// Returns unsigned atomic transaction group for wallet to sign
Body: { buyerAddress: string, amountMicroAlgo: number }
Response: {
  unsignedTxns: string[], // base64 encoded unsigned transactions
  // Frontend passes these to use-wallet for signing
}
```

### POST `/api/escrow/:id/deliver`
```typescript
// Oracle endpoint — called by marketplace webhook or backend cron
Body: { secret: string }  // API key for authorized callers
Response: { txId: string, loraUrl: string }
```

### POST `/api/escrow/:id/submit-work`
```typescript
Body: {
  sellerAddress: string,
  githubUrl?: string,
  description: string,
  screenshotsUrls?: string[],
}
Response: {
  deliverablesHash: string,  // SHA256 of submitted package
  txId: string,
  message: "AI verification triggered"
}
// Backend: stores deliverables, calls submitDeliverables() on contract,
//          then triggers AI verification asynchronously
```

### GET `/api/escrow/:id`
```typescript
Response: {
  appId: number,
  escrowAddress: string,
  buyer: string,
  seller: string,
  amount: number,       // in ALGO
  state: EscrowState,
  stateName: string,    // "FUNDED", "COMPLETED", etc.
  escrowType: EscrowType,
  itemName: string,
  deadlineRound: number,
  currentRound: number,
  roundsRemaining: number,
  aiScore?: number,
  aiVerdictNote?: string,
  loraUrl: string,
  txHistory: TxEvent[],
}
```

---

## 8. AI Verification Service

**File:** `backend/src/services/ai.service.ts`

```typescript
// Prompt structure for Claude API
const systemPrompt = `You are an escrow verification AI for AlgoEscrow, a blockchain platform.
Your job is to evaluate whether a freelancer's submitted work meets the client's requirements.
Be objective, fair, and specific. Return ONLY valid JSON.`

const userPrompt = `
ORIGINAL REQUIREMENTS:
${requirements}

SUBMITTED DELIVERABLES:
GitHub URL: ${githubUrl || 'Not provided'}
Description: ${description}
Screenshots provided: ${screenshotsUrls.length}

Evaluate the deliverables against the requirements. Return this exact JSON:
{
  "score": <integer 0-100>,
  "matched_criteria": ["...", "..."],
  "missing_criteria": ["...", "..."],
  "verdict": "<one sentence explanation>",
  "recommendation": "RELEASE" | "DISPUTE"
}

Score guide: 0-49 = major gaps, 50-74 = partial completion, 75-89 = good, 90-100 = excellent.
RELEASE if score >= 75. DISPUTE if score < 75.`

// After getting response:
// if recommendation == "RELEASE": call aiVerdict(true, score, verdict) on contract
// if recommendation == "DISPUTE": call aiVerdict(false, score, verdict) on contract
// Store full AI response in Box Storage of contract (ARC-2 note)
```

---

## 9. Frontend — Key Component Specifications

### StateMachineBadge.tsx
Visual progress indicator showing current state. 7 steps, color-coded:
- CREATED → gray
- FUNDED → blue (pulsing animation)
- DELIVERED → yellow
- COMPLETED → green ✓
- DISPUTED → orange ⚠
- REFUNDED → purple ↩
- EXPIRED → red ✗

### EscrowDetail.tsx
Main page for any escrow. Shows:
1. State machine progress bar (StateMachineBadge)
2. Parties (buyer/seller addresses with Algorand icon)
3. Amount + fee breakdown
4. Deadline countdown (rounds remaining → human time)
5. Action buttons (context-aware based on state + wallet address):
   - If buyer + FUNDED: "Confirm Delivery" | "Raise Dispute"
   - If seller + FUNDED: "Submit Deliverables" (freelance only)
   - If buyer + FUNDED + expired: "Request Refund"
6. AI Verdict Panel (freelance only): score gauge, matched/missing criteria
7. Transaction history: every state change with LORA link
8. Copy escrow link button

### TxnExplorerLink.tsx
Every transaction displayed shows:
```
Tx: ABC123...XYZ  [View on LORA ↗]
Link: https://lora.algokit.io/testnet/transaction/{txId}
```

---

## 10. ShopDemo — Dummy Marketplace

**Purpose:** Shows judges that AlgoEscrow is a B2B platform that ANY marketplace can integrate.

**Flow:**
1. Browse products page (3-4 hardcoded products)
2. Click "Buy with AlgoEscrow" on a product
3. Checkout page: connects Pera Wallet, creates escrow via `@algoescrow/sdk`
4. Fund escrow: atomic txn signed via Pera Wallet
5. Order Status page: shows live escrow state, links to AlgoEscrow dashboard
6. "Seller Ships" button → calls deliver oracle → funds auto-release
7. Redirects to "Transaction Complete" page with on-chain proof

**SDK Usage (what judges see):**
```typescript
import { AlgoEscrow } from '@algoescrow/sdk'

// This is ALL a marketplace needs to integrate:
const escrow = await AlgoEscrow.create({
  apiUrl: 'https://api.algoescrow.com',
  seller: sellerAddress,
  itemName: product.name,
  amount: product.price,
  deadlineHours: 72,
  escrowType: 'marketplace',
  webhookUrl: 'https://shopdemo.com/webhooks/escrow',
})

// Returns { appId, escrowAddress, fundingUrl }
// Redirect buyer to fundingUrl to complete payment
```

---

## 11. Development Sequence (24 Hours)

### Hour 0–1: Bootstrap Everything
```bash
pip install algokit
npm install -g vibekit

# Create workspace
algokit init --workspace --name algoescrow

# Add contracts project (TypeScript)
cd algoescrow
algokit init --template smart_contract --language typescript --name contracts

# Add frontend
algokit init --template react --name frontend

# Start local chain
algokit localnet start
algokit localnet explore  # open LORA

# Initialize VibeKit AI agent
vibekit init
```

### Hour 1–5: Smart Contracts
1. Write `constants.ts` (EscrowState + EscrowType enums)
2. Write `escrow_contract.algo.ts` with ALL 8 methods
3. Write `escrow_factory.algo.ts`
4. Run tests: `cd contracts && npm test`
5. Deploy to LocalNet: `algokit project deploy localnet`
6. Verify in LORA — inspect global state after each method call
7. Deploy to Testnet: `algokit project deploy testnet`
8. Note the App IDs — hardcode as constants

### Hour 5–8: Backend API
1. Setup Express + TypeScript
2. Copy auto-generated TypedAppClients to `backend/src/contracts/`
3. Write `algorand.service.ts` (AlgoKit Utils setup + contract calls)
4. Write all routes in `escrow.routes.ts`
5. Write `ai.service.ts` (Claude API integration)
6. Test all endpoints with curl/Postman against Testnet contracts

### Hour 8–14: Frontend
1. Use AlgoKit React template (Tailwind + DaisyUI pre-configured)
2. Configure `use-wallet` with Pera + Defly providers
3. Build: Landing → CreateEscrow → EscrowDetail → Dashboard
4. Wire all action buttons to backend API calls
5. Add StateMachineBadge component
6. Add LORA links to every transaction

### Hour 14–18: Freelance Flow + AI
1. Build FreelanceEscrow page (submit work form)
2. Connect to AI verification backend
3. Build AIVerdictPanel component (score gauge + criteria list)
4. Test full freelance flow end-to-end

### Hour 18–20: ShopDemo + SDK
1. Build `@algoescrow/sdk` minimal wrapper
2. Build ShopDemo React app
3. Test full marketplace integration flow

### Hour 20–22: Polish + Deploy
1. Deploy frontend to Vercel
2. Deploy backend to Railway/Render
3. Test entire flow on Testnet with real wallets
4. Add QR code for mobile wallet scanning
5. Fix all broken states + error handling

### Hour 22–24: Demo Prep
1. Record backup video demo (full happy path)
2. Write 2-minute pitch script
3. Prepare: App ID on screen, LORA open in browser tab
4. Test 3 demo flows: marketplace, P2P, freelance
5. Rehearse dispute → arbitration → resolution flow

---

## 12. Environment Variables

```bash
# backend/.env
ALGORAND_NETWORK=testnet
ALGORAND_ALGOD_URL=https://testnet-api.algonode.cloud
ALGORAND_INDEXER_URL=https://testnet-idx.algonode.cloud
ESCROW_FACTORY_APP_ID=<deployed_app_id>
PLATFORM_TREASURY_ADDRESS=<your_algo_address>
ARBITER_MNEMONIC=<25 word mnemonic for arbiter wallet>
ORACLE_MNEMONIC=<25 word mnemonic for delivery oracle wallet>
ANTHROPIC_API_KEY=<claude_api_key>
API_SECRET=<random_string_for_oracle_endpoint_auth>
PORT=3001

# frontend/.env
VITE_API_URL=http://localhost:3001
VITE_ALGORAND_NETWORK=testnet
VITE_ESCROW_FACTORY_APP_ID=<same_as_backend>
```

---

## 13. Key Algorand Concepts Used (For AI Agent Reference)

| Concept | Where Used | Why |
|---|---|---|
| **Stateful Smart Contract** | EscrowContract | Stores escrow state on-chain |
| **Global State** | EscrowContract | buyer, seller, amount, state vars |
| **Inner Transactions** | fund release, refund | Contract pays parties autonomously |
| **Atomic Transaction Group** | fund() call | Payment + app call must both succeed |
| **App Address** | Escrow vault | Contract's own address holds funds |
| **ABI / ARC-4** | All methods | Typed method interface standard |
| **Round-based deadline** | deadline_round | Trustless time without external oracle |
| **Factory Pattern** | EscrowFactory | Deploys child contracts per deal |
| **Algorand Indexer** | Backend polling | Detect state changes, build history |
| **AlgoKit TypedAppClient** | Backend + Frontend | Type-safe contract interaction |
| **AlgoKit LocalNet** | Development | Free local blockchain for testing |
| **LORA Explorer** | Demo | On-chain proof for judges |
| **Testnet Dispenser** | Testing | Free ALGO for test accounts |

---

## 14. Judge Demo Script

### Demo Flow (12 minutes)

**Minute 0–2: Pitch**
> "AlgoEscrow is Escrow.com rebuilt on Algorand. 
>  Escrow.com charges 3.25%, takes days, and holds your money.
>  We charge 0.5%, settle in 2.8 seconds, and a smart contract holds your money.
>  Any marketplace integrates us in one line of code.
>  Let me show you three live flows on Algorand Testnet."

**Minute 2–5: Marketplace Flow (ShopDemo)**
- Open ShopDemo, browse products
- Click "Buy with AlgoEscrow" on a product
- Show AlgoKit Utils creating the escrow contract (App ID appears)
- Sign funding transaction with Pera Wallet
- Click "Open App ID on LORA" — show live global state: state=1 (FUNDED), amount locked
- Click "Mark as Delivered" (oracle) → funds released instantly
- Show final LORA state: state=3 (COMPLETED), seller balance increased

**Minute 5–8: Freelance Flow (AI Verification)**
- Create new Freelance Escrow
- Submit deliverables: paste a GitHub URL + description
- Show backend calling Claude API — display raw AI verdict JSON on screen
- AI score appears: "82/100 — RELEASE"
- Show contract state change to COMPLETED on LORA
- Note: "The verdict hash is stored on-chain permanently"

**Minute 8–11: Dispute Flow**
- Create P2P escrow, fund it
- Buyer clicks "Raise Dispute"
- Show state=4 (DISPUTED) on LORA
- Open Arbiter panel, click "Release to Seller"
- Show COMPLETED on LORA — seller paid

**Minute 11–12: Wrap Up**
> "Every state change is a real Algorand transaction.
>  Here's our Factory contract App ID: [show it].
>  Any marketplace can integrate this in one afternoon using our SDK.
>  AlgoEscrow is infrastructure, not an app."

---

## 15. AlgoEscrow Differentiators (For Judges)

1. **EaaS Architecture**: API-first, not app-first — any marketplace integrates
2. **Factory Pattern**: Clean one-contract-per-deal isolation
3. **Three escrow modes**: Marketplace + P2P + Freelance in one protocol
4. **AI Verification**: Claude API scores freelance work, verdict stored on-chain
5. **Atomic Groups**: Fund + record buyer in one unbreakable transaction
6. **Inner Transactions**: Contract pays parties directly — no human relay
7. **Round-based deadlines**: Trustless timeout without any external timer
8. **0.5% fee vs 3.25%**: Concrete business model and cost advantage
9. **2.8 second finality**: vs days for traditional escrow
10. **LORA proof**: Every demo action has a clickable on-chain receipt

---

*End of agent.md — AlgoEscrow v1.0 Hackathon Build Specification*
