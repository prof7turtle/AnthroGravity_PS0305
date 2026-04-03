/**
 * AlgoEscrow — Shared Constants & Enums
 *
 * These enums are used by both EscrowFactory and EscrowContract.
 * NOTE: In Algorand TypeScript (PuyaTs), enums are represented as uint64 constants.
 *       We export them as plain const objects to be AVM-compatible.
 */

// ---------------------------------------------------------------------------
// EscrowState — Tracks the state machine of each escrow deal
// ---------------------------------------------------------------------------
// CREATED   = 0  → Contract deployed, waiting for buyer to fund
// FUNDED    = 1  → Buyer has deposited funds, locked in contract address
// DELIVERED = 2  → Delivery/completion confirmed (buyer, oracle, or AI)
// COMPLETED = 3  → Funds released to seller via inner transaction
// DISPUTED  = 4  → Either party raised a dispute, awaiting arbitration
// REFUNDED  = 5  → Funds returned to buyer via inner transaction
// EXPIRED   = 6  → Deadline passed, no action → refund available
export const EscrowState = {
  CREATED: 0 as const,
  FUNDED: 1 as const,
  DELIVERED: 2 as const,
  COMPLETED: 3 as const,
  DISPUTED: 4 as const,
  REFUNDED: 5 as const,
  EXPIRED: 6 as const,
} as const

// ---------------------------------------------------------------------------
// EscrowType — Determines escrow mode and verification method
// ---------------------------------------------------------------------------
// MARKETPLACE = 0  → Physical goods, oracle-confirmed delivery
// P2P         = 1  → Direct deal, buyer manually confirms
// FREELANCE   = 2  → Digital work, AI-verified completion (Claude API)
export const EscrowType = {
  MARKETPLACE: 0 as const,
  P2P: 1 as const,
  FREELANCE: 2 as const,
} as const
