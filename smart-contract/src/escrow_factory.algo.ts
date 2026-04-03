/**
 * AlgoEscrow — EscrowFactory Contract
 *
 * Deployed ONCE by the AlgoEscrow team.
 * Acts as the single registry and deployer of individual EscrowContract instances.
 *
 * Any marketplace/user calls createEscrow() here to get a new EscrowContract
 * deployed with its own unique Algorand App ID and address (vault).
 *
 * Pattern: Factory / Registry
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
  itxn,
  Txn,
  uint64,
  Bytes,
  bytes,
  Application,
  op,
} from '@algorandfoundation/algorand-typescript'

export class EscrowFactory extends Contract {
  // ── Platform config (set at deployment, updatable by creator) ─────────────
  platform_treasury = GlobalState<Account>({ initialValue: Account() })
  platform_fee_bps = GlobalState<uint64>({ initialValue: 50 as uint64 }) // default 0.5%
  total_escrows = GlobalState<uint64>({ initialValue: 0 as uint64 })
  arbiter_address = GlobalState<Account>({ initialValue: Account() })

  // ── Stored approval/clear program for EscrowContract child deployment ─────
  // In production: these reference the compiled EscrowContract app pages.
  // For localnet/testnet, the compiled app is uploaded as reference to factory.
  escrow_contract_approval_len = GlobalState<uint64>({ initialValue: 0 as uint64 })
  escrow_contract_app_id = GlobalState<Application>({ initialValue: Application() })

  // ────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE: createApplication
  // Called once at deployment. Sets platform configuration.
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the platform with treasury address, fee, and arbiter.
   *
   * @param treasury  - AlgoEscrow fee wallet (receives platform fees)
   * @param feeBps    - Platform fee in basis points (50 = 0.5%)
   * @param arbiter   - Address authorized to resolve disputes
   */
  @abimethod({ allowActions: 'NoOp', onCreate: 'require' })
  public createApplication(treasury: Account, feeBps: uint64, arbiter: Account): void {
    this.platform_treasury.value = treasury
    this.platform_fee_bps.value = feeBps
    this.arbiter_address.value = arbiter
    this.total_escrows.value = 0 as uint64
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD: createEscrow
  // Core factory method. Deploys a new EscrowContract for a deal.
  // Returns the new contract's App ID.
  //
  // Caller must send 3 transactions in atomic group:
  //   Txn 0: Payment (MBR funding for new child contract)
  //   Txn 1: AppCall → createEscrow() (this method)
  //
  // escrowType: 0=MARKETPLACE, 1=P2P, 2=FREELANCE
  // deadlineRounds: number of Algorand rounds until escrow expires (~3.3s each)
  // requirementsHash: SHA256(requirements text) for FREELANCE, empty bytes for others
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public createEscrow(
    seller: Account,
    itemName: bytes,
    escrowType: uint64,
    deadlineRounds: uint64,
    requirementsHash: bytes,
    escrowContractApp: Application,  // Reference to compiled EscrowContract app
  ): uint64 {
    // Validate escrow type
    assert(escrowType <= (2 as uint64), 'Invalid escrow type (must be 0, 1, or 2)')

    // Validate deadline is in the future
    assert(deadlineRounds > (0 as uint64), 'Deadline rounds must be greater than 0')

    // Validate seller is provided
    assert(seller !== Account(), 'Seller address must be provided')

    // Compute actual deadline round
    const deadlineRound = (Global.round + deadlineRounds) as uint64

    // ── Inner Transaction: Deploy new EscrowContract ──────────────────────────
    // Uses the pre-deployed EscrowContract as template (copy app pages)
    const newEscrow = itxn
      .applicationCall({
        approvalProgram: escrowContractApp.approvalProgram,
        clearStateProgram: escrowContractApp.clearStateProgram,
        globalNumUint: 12 as uint64,   // number of uint64 global state slots
        globalNumBytes: 8 as uint64, // number of bytes global state slots
        localNumUint: 0 as uint64,
        localNumBytes: 0 as uint64,
        fee: 0 as uint64,
        appArgs: [
          // createApplication args packed for the child contract
          seller.bytes,
          itemName,
          op.itob(escrowType),
          op.itob(deadlineRound),
          requirementsHash,
          op.itob(this.platform_fee_bps.value),
          this.platform_treasury.value.bytes,
          this.arbiter_address.value.bytes,
        ],
        accounts: [seller, this.platform_treasury.value, this.arbiter_address.value],
      })
      .submit()

    // Increment global escrow counter
    this.total_escrows.value = this.total_escrows.value + (1 as uint64)

    // Return new child App ID
    return newEscrow.createdApp.id
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD: getPlatformConfig (read-only)
  // Returns treasury address, fee bps, and total escrows created.
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp', readonly: true })
  public getPlatformConfig(): readonly [Account, uint64, uint64, Account] {
    return [
      this.platform_treasury.value,
      this.platform_fee_bps.value,
      this.total_escrows.value,
      this.arbiter_address.value,
    ] as const
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD: updateFee (admin only)
  // Allows creator to update the platform fee in basis points.
  // Max fee: 1000 bps = 10% (enforced to prevent abuse)
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public updateFee(newFeeBps: uint64): void {
    // Gate: only creator can update fee
    assert(Txn.sender === Global.creatorAddress, 'Only the creator can update the platform fee')

    // Gate: cap at 10% to prevent abuse
    assert(newFeeBps <= (1000 as uint64), 'Fee cannot exceed 1000 basis points (10%)')

    this.platform_fee_bps.value = newFeeBps
  }

  // ────────────────────────────────────────────────────────────────────────────
  // METHOD: updateArbiter (admin only)
  // Allows creator to update the arbiter address.
  // ────────────────────────────────────────────────────────────────────────────

  @abimethod({ allowActions: 'NoOp' })
  public updateArbiter(newArbiter: Account): void {
    // Gate: only creator can update arbiter
    assert(Txn.sender === Global.creatorAddress, 'Only the creator can update the arbiter')

    assert(newArbiter !== Account(), 'Arbiter address must be valid')

    this.arbiter_address.value = newArbiter
  }
}
