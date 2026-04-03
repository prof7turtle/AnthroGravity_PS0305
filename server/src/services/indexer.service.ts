import { EscrowState } from '../models/Escrow';

type EscrowLike = {
  appId?: number | null;
  appAddress?: string;
  amount: number;
  state: EscrowState;
  escrowType: string;
  itemName: string;
  deadlineAt: Date | string;
  aiScore?: number | null;
  aiVerdict?: { verdict?: string };
  activityLogs?: Array<{
    action: string;
    fromState: string;
    toState: string;
    actor: string;
    txId: string;
    note: string;
    createdAt?: string;
  }>;
};

const toRoundEstimate = (futureDate: Date) => {
  const msLeft = futureDate.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.floor(msLeft / 3300);
};

export const mapEscrowStateName = (state: EscrowState) => state;

export const toEscrowPublicView = (escrow: EscrowLike & { [k: string]: any }) => {
  const deadlineAt = escrow.deadlineAt instanceof Date ? escrow.deadlineAt : new Date(escrow.deadlineAt);
  const roundsRemaining = toRoundEstimate(deadlineAt);
  const currentRound = 0;

  return {
    ...escrow,
    appId: escrow.appId ?? null,
    escrowAddress: escrow.appAddress || '',
    amountAlgo: Number(escrow.amount) / 1_000_000,
    stateName: mapEscrowStateName(escrow.state),
    roundsRemaining,
    currentRound,
    txHistory: escrow.activityLogs ?? [],
  };
};
