<a href=https://algoescrow.vercel.app/>
<img width="1857" height="938" alt="Screenshot 2026-04-04 063922" src="https://github.com/user-attachments/assets/6f53fb8b-d97d-4cd3-badb-e9262dffa9a4" />
</a>
# AlgoEscrow

### Trust-Minimized Escrow Infrastructure on Algorand



> Secure digital transactions without relying on intermediaries.

---

## Overview

AlgoEscrow is a blockchain-based escrow system that enables **secure, transparent, and automated transactions** between buyers and sellers.

It removes the need for trust by:

* Locking funds on-chain
* Enforcing rules via smart contracts
* Releasing or refunding funds based on verified outcomes

---

## Problem

In digital transactions:

* Buyers risk paying without receiving goods/services
* Sellers risk delivering without guaranteed payment
* Existing escrow systems are slow, costly, and opaque

---

## Solution

AlgoEscrow introduces a **trust-minimized system** where:

1. Funds are secured during a transaction
2. Actions follow predefined rules
3. Outcomes are enforced automatically

This ensures fairness without relying on a central authority.

---

## How It Works

```text
Create Escrow → Fund → Lock Funds
                         ↓
                  Work / Delivery
                         ↓
          Release to Seller OR Refund to Buyer
```

---

## Key Features

* **On-chain verification**
  All payments are validated on the blockchain

* **Deterministic state machine**
  Clear and enforced transaction lifecycle

* **Multiple use cases**
  Marketplace, P2P, and freelance workflows

* **API-first design**
  Easily integrates into platforms and applications

* **Transparent auditability**
  Every transaction is publicly verifiable

---

## System Architecture

```text
Frontend → Backend → Wallet → Blockchain
                      ↓
                Smart Contract
```

* **Frontend**: User workflows and UI
* **Backend**: APIs, validation, orchestration
* **Wallet**: Signs transactions (user-controlled)
* **Blockchain**: Final authority and fund custody

---

## Escrow Lifecycle

```text
CREATED → FUNDED → COMPLETED
             |          ^
             v          |
          DISPUTED -----+
             |
             v
          REFUNDED
```

---

## Technology Stack

| Layer      | Technology                |
| ---------- | ------------------------- |
| Blockchain | Algorand                  |
| Backend    | Node.js, Express, MongoDB |
| Frontend   | React, Vite, Tailwind CSS |
| Wallet     | Pera Wallet               |
| SDK        | algosdk, algokit-utils    |

---

## API Overview

Base: `/api/escrow`

* `POST /create`
* `POST /:id/fund`
* `POST /:id/confirm-fund`
* `GET /:id`
* `GET /:id/reconcile`
* `POST /:id/submit`
* `POST /:id/verify`
* `POST /:id/dispute`
* `POST /:id/refund`
* `POST /:id/resolve`

---

## Local Setup

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

### Smart Contracts

```bash
cd smart-contract
npm install
npm run deploy
```

---

## Environment Variables

### Backend

* `ALGORAND_NETWORK`
* `ALGORAND_ALGOD_URL`
* `ALGORAND_INDEXER_URL`
* `ESCROW_FACTORY_APP_ID`
* `MONGO_URI`

### Frontend

* `VITE_API_URL`
* `VITE_ALGORAND_NETWORK`

---

## Demo Flow

1. Create escrow
2. Fund using wallet
3. Verify transaction on-chain
4. Submit work or confirm delivery
5. Release or refund funds
6. View transaction on explorer

---

## Current Status

* Real on-chain funding and verification implemented
* Backend-driven state management
* Smart contract custody integration in progress

---

## Team : AnthroGravity

* Sujal Pawar
* Harshil Bohra
* Hariom Phulre

---

## Summary

AlgoEscrow provides a reliable way to conduct transactions by combining **blockchain security with practical application design**, enabling trust without intermediaries.
