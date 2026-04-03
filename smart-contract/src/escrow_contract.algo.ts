/**
 * AlgoEscrow — EscrowContract
 *
 * One instance deployed per transaction/deal.
 * The contract's own Algorand address IS the escrow vault — all funds are held here.
 *
 * State Machine:
 *   CREATED(0) → FUNDED(1) → DELIVERED(2) → COMPLETED(3)
 *                           → DISPUTED(4)  → COMPLETED(3) or REFUNDED(5)
 *                           → EXPIRED(6)   → REFUNDED(5)
 *
 * Hackathon: AlgoEscrow — PS0305
 * Built with Algorand TypeScript (PuyaTs) / AlgoKit 3.0
 */

import {
  abimethod,
  Account,
  assert,
  Contract,
  Global,
  GlobalState,
  gtxn,
  itxn,
  Txn,
  uint64,
  Bytes,
  bytes,
} from '@algorandfoundation/algorand-typescript'

// ── State constants (uint64) ─────────────────────────────────────────────────
const STATE_CREATED = 0 as uint64
const STATE_FUNDED = 1 as uint64
const STATE_DELIVERED = 2 as uint64
const STATE_COMPLETED = 3 as uint64
const STATE_DISPUTED = 4 as uint64
const STATE_REFUNDED = 5 as uint64
const STATE_EXPIRED = 6 as uint64

// ── Type constants (uint64) ──────────────────────────────────────────────────
const TYPE_MARKETPLACE = 0 as uint64
const TYPE_P2P = 1 as uint64
const TYPE_FREELANCE = 2 as uint64

export class EscrowContract extends Contract {
  // ── Parties ────────────────────────────────────────────────────────────────
  buyer = GlobalState<Account>({ initialValue: Account() })
  seller = GlobalState<Account>({ initialValue: Account() })

  // ── Deal metadata ──────────────────────────────────────────────────────────
  item_name = GlobalState<bytes>({ initialValue: Bytes('') })
  escrow_type = GlobalState<uint64>({ initialValue: 0 as uint64 })
  amount = GlobalState<uint64>({ initialValue: 0 as uint64 })

  // ── State machine ──────────────────────────────────────────────────────────
  state = GlobalState<uint64>({ initialValue: STATE_CREATED })
  created_round = GlobalState<uint64>({ initialValue: 0 as uint64 })
  deadline_round = GlobalState<uint64>({ initialValue: 0 as uint64 })

  // ── Fee config (copied from factory at creation) ───────────────────────────
  platform_fee_bps = GlobalState<uint64>({ initialValue: 50 as uint64 }) // 0.5%
  platform_treasury = GlobalState<Account>({ initialValue: Account() })

  // ── Freelance-specific ─────────────────────────────────────────────────────
  requirements_hash = GlobalState<bytes>({ initialValue: Bytes('') })
  deliverables_hash = GlobalState<bytes>({ initialValue: Bytes('') })
  ai_score = GlobalState<uint64>({ initialValue: 0 as uint64 })
  ai_verdict_note = GlobalState<bytes>({ initialValue: Bytes('') })

  // ── Dispute ────────────────────────────────────────────────────────────────
  arbiter = GlobalState<Account>({ initialValue: Account() })
  dispute_raised_by = GlobalState<Account>({ initialValue: Account() })

  // ── Transaction tracking ───────────────────────────────────────────────────
  last_txn_note = GlobalState<bytes>({ initialValue: Bytes('') })

  // ────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Called by EscrowFactory via inner application create transaction.
   * Sets up all initial escrow metadata.
   *
   * @param seller         - Address of seller/freelancer
   * @param itemName       - Human-readable description of the deal
   * @param escrowType     - 0=MARKETPLACE, 1=P2P, 2=FREELANCE
   * @param deadlineRound  - Algorand round after which escrow expires
   * @param requirementsHash - SHA256 of requirements text (freelance only, else empty)
   * @param feeBps         - Platform fee in basis points (e.g. 50 = 0.5%)
   * @param treasury       - Platform treasury address that receives fees
   * @param arbiterAddr    - Address authorized to resolve disputes
   */
  @abimethod({ allowActions: 'NoOp', onCreate: 'require' })
  public createApplication(
    seller: Account,
    itemName: bytes,
    escrowType: uint64,
    deadlineRound: uint64,
    requirementsHash: bytes,
    feeBps: uint64,
    treasury: Account,
    arbiterAddr: Account,
  ): void {
    this.seller.value = seller
    this.item_name.value = itemName
    this.escrow_type.value = escrowType
    this.deadline_round.value = deadlineRound
    this.requirements_hash.value = requirementsHash
    this.platform_fee_bps.value = feeBps
    this.platform_treasury.value = treasury
    this.arbiter.value = arbiterAddr
    this.created_round.value = Global.round
    this.state.value = STATE_CREATED
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 1: fund()
  // Buyer locks funds in the escrow vault (contract address).
  // Must be called as atomic group: [PaymentTxn, AppCallTxn]
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public fund(payment: gtxn.PaymentTxn): void {
    // Gate: must be in CREATED state
    assert(this.state.value === STATE_CREATED, 'Escrow must be in CREATED state')

    // Gate: deadline must not have passed
    assert(Global.round <= this.deadline_round.value, 'Escrow has expired')

    // Gate: payment must go to THIS contract's address (the vault)
    assert(
      payment.receiver === Global.currentApplicationAddress,
      'Payment receiver must be the escrow contract address',
    )

    // Gate: payment sender must be the same as the app call sender
    assert(payment.sender === Txn.sender, 'Payment sender must match app call sender')

    // Gate: payment must be non-zero
    assert(payment.amount > (0 as uint64), 'Payment amount must be greater than 0')

    // Record buyer and lock amount
    this.buyer.value = Txn.sender
    this.amount.value = payment.amount
    this.state.value = STATE_FUNDED
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 2: confirmDelivery()
  // Confirms goods/service delivered → releases funds to seller.
  // Who: Buyer (Mode 1+2) OR backend oracle (Global.creatorAddress, Mode 1)
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public confirmDelivery(): void {
    // Gate: must be FUNDED
    assert(this.state.value === STATE_FUNDED, 'Escrow must be in FUNDED state')

    // Gate: only buyer or creator (oracle) can confirm
    assert(
      Txn.sender === this.buyer.value || Txn.sender === Global.creatorAddress,
      'Only buyer or oracle can confirm delivery',
    )

    this.state.value = STATE_DELIVERED

    // Calculate fee split
    const feeAmount = (this.amount.value * this.platform_fee_bps.value) / (10000 as uint64)
    const sellerAmount = this.amount.value - feeAmount

    // Inner Txn A: pay seller
    itxn
      .payment({
        receiver: this.seller.value,
        amount: sellerAmount,
        fee: 0 as uint64,
      })
      .submit()

    // Inner Txn B: pay platform fee to treasury
    if (feeAmount > (0 as uint64)) {
      itxn
        .payment({
          receiver: this.platform_treasury.value,
          amount: feeAmount,
          fee: 0 as uint64,
        })
        .submit()
    }

    this.state.value = STATE_COMPLETED
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 3: requestRefund()
  // Returns locked funds to buyer after deadline passes.
  // No platform fee on refunds — buyer gets full amount back.
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public requestRefund(): void {
    // Gate: must be FUNDED
    assert(this.state.value === STATE_FUNDED, 'Escrow must be in FUNDED state')

    // Gate: only buyer can request refund
    assert(Txn.sender === this.buyer.value, 'Only buyer can request a refund')

    // Gate: deadline must have passed
    assert(Global.round > this.deadline_round.value, 'Deadline has not passed yet')

    // Inner Txn: full refund to buyer (no fee)
    itxn
      .payment({
        receiver: this.buyer.value,
        amount: this.amount.value,
        fee: 0 as uint64,
      })
      .submit()

    this.state.value = STATE_REFUNDED
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 4: raiseDispute()
  // Pauses escrow and escalates to arbitration.
  // Funds remain locked — only arbiter can resolve.
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public raiseDispute(): void {
    // Gate: must be FUNDED
    assert(this.state.value === STATE_FUNDED, 'Escrow must be in FUNDED state')

    // Gate: only buyer can raise dispute
    assert(Txn.sender === this.buyer.value, 'Only buyer can raise a dispute')

    // Gate: must be within deadline (can't dispute after expiry)
    assert(Global.round <= this.deadline_round.value, 'Cannot dispute after deadline')

    this.state.value = STATE_DISPUTED
    this.dispute_raised_by.value = Txn.sender
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 5: arbitrate(releaseToSeller)
  // Final resolution by the authorized arbiter address.
  // releaseToSeller=true  → seller paid (COMPLETED)
  // releaseToSeller=false → buyer refunded (REFUNDED)
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public arbitrate(releaseToSeller: boolean): void {
    // Gate: must be DISPUTED
    assert(this.state.value === STATE_DISPUTED, 'Escrow must be in DISPUTED state')

    // Gate: only the designated arbiter can resolve
    assert(Txn.sender === this.arbiter.value, 'Only the arbiter can resolve a dispute')

    if (releaseToSeller) {
      // Arbiter sides with seller: calculate fee and pay out
      const feeAmount = (this.amount.value * this.platform_fee_bps.value) / (10000 as uint64)
      const sellerAmount = this.amount.value - feeAmount

      itxn
        .payment({
          receiver: this.seller.value,
          amount: sellerAmount,
          fee: 0 as uint64,
        })
        .submit()

      if (feeAmount > (0 as uint64)) {
        itxn
          .payment({
            receiver: this.platform_treasury.value,
            amount: feeAmount,
            fee: 0 as uint64,
          })
          .submit()
      }

      this.state.value = STATE_COMPLETED
    } else {
      // Arbiter sides with buyer: full refund, no fee
      itxn
        .payment({
          receiver: this.buyer.value,
          amount: this.amount.value,
          fee: 0 as uint64,
        })
        .submit()

      this.state.value = STATE_REFUNDED
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 6: submitDeliverables(deliverablesHash)
  // Freelancer submits proof-of-work hash on-chain.
  // State stays FUNDED — backend detects change and triggers AI verification.
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public submitDeliverables(deliverablesHash: bytes): void {
    // Gate: must be FUNDED
    assert(this.state.value === STATE_FUNDED, 'Escrow must be in FUNDED state')

    // Gate: only seller (freelancer) can submit deliverables
    assert(Txn.sender === this.seller.value, 'Only the seller can submit deliverables')

    // Gate: only FREELANCE type escrows use this method
    assert(this.escrow_type.value === TYPE_FREELANCE, 'Only freelance escrows accept deliverables')

    // Store hash on-chain (backend will poll this via Indexer)
    this.deliverables_hash.value = deliverablesHash
    // NOTE: State intentionally stays at FUNDED — AI verdict changes state
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 7: aiVerdict(approved, score, verdictNote)
  // Called by the AlgoEscrow backend oracle after Claude API evaluation.
  // approved=true (score≥75)  → auto-release to seller (COMPLETED)
  // approved=false (score<75) → escalate to arbiter (DISPUTED)
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public aiVerdict(approved: boolean, score: uint64, verdictNote: bytes): void {
    // Gate: only the contract creator (our backend oracle) can call this
    assert(Txn.sender === Global.creatorAddress, 'Only the backend oracle can submit AI verdicts')

    // Gate: must be FUNDED
    assert(this.state.value === STATE_FUNDED, 'Escrow must be in FUNDED state')

    // Gate: must be FREELANCE type
    assert(this.escrow_type.value === TYPE_FREELANCE, 'Only freelance escrows support AI verdict')

    // Gate: deliverables must have been submitted first
    assert(this.deliverables_hash.value !== Bytes(''), 'Deliverables must be submitted before AI verdict')

    // Store AI result on-chain permanently
    this.ai_score.value = score
    this.ai_verdict_note.value = verdictNote

    if (approved) {
      // AI approved: calculate fee and pay seller
      const feeAmount = (this.amount.value * this.platform_fee_bps.value) / (10000 as uint64)
      const sellerAmount = this.amount.value - feeAmount

      itxn
        .payment({
          receiver: this.seller.value,
          amount: sellerAmount,
          fee: 0 as uint64,
        })
        .submit()

      if (feeAmount > (0 as uint64)) {
        itxn
          .payment({
            receiver: this.platform_treasury.value,
            amount: feeAmount,
            fee: 0 as uint64,
          })
          .submit()
      }

      this.state.value = STATE_COMPLETED
    } else {
      // AI rejected: escalate to human arbitration
      this.state.value = STATE_DISPUTED
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD 8: getDetails() — Read-only view of all escrow state
  // Used by frontend/API for polling current state.
  // Returns a tuple of all key state variables.
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp', readonly: true })
  public getDetails(): readonly [
    Account,  // buyer
    Account,  // seller
    uint64,   // amount (microALGO)
    uint64,   // state (EscrowState enum)
    uint64,   // escrowType (EscrowType enum)
    bytes,    // item_name
    uint64,   // deadline_round
    uint64,   // current_round
    uint64,   // ai_score
    uint64,   // platform_fee_bps
    bytes,    // deliverables_hash (empty if not submitted)
    bytes,    // ai_verdict_note (empty if not AI-verified)
    Account,  // arbiter
  ] {
    return [
      this.buyer.value,
      this.seller.value,
      this.amount.value,
      this.state.value,
      this.escrow_type.value,
      this.item_name.value,
      this.deadline_round.value,
      Global.round,
      this.ai_score.value,
      this.platform_fee_bps.value,
      this.deliverables_hash.value,
      this.ai_verdict_note.value,
      this.arbiter.value,
    ] as const
  }
}
