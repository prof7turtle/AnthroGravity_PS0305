/**
 * Type definitions for AlgoEscrow backend
 */

export enum EscrowState {
  CREATED = 0,
  FUNDED = 1,
  DELIVERED = 2,
  COMPLETED = 3,
  DISPUTED = 4,
  REFUNDED = 5,
  EXPIRED = 6,
}

export enum EscrowType {
  MARKETPLACE = 0,
  P2P = 1,
  FREELANCE = 2,
}

export interface EscrowStateData {
  buyer: string | null;
  seller: string | null;
  amount: number;
  state: EscrowState;
  escrowType: EscrowType;
  itemName: string;
  createdRound: number;
  deadlineRound: number;
  platformFeeBps: number;
  platformTreasury: string | null;
  arbiter: string | null;
  requirementsHash: Buffer | null;
  deliverablesHash: Buffer | null;
  aiScore: number;
  aiVerdictNote: string;
  disputeRaisedBy: string | null;
  lastTxnNote: string;
}

export interface CreateEscrowRequest {
  seller: string;
  itemName: string;
  escrowType: EscrowType;
  deadlineRounds: number;
  requirements?: string; // For FREELANCE type
}

export interface FundEscrowRequest {
  buyer: string;
  amount: number;
}

export interface DeliverEscrowRequest {
  deliverables?: string; // For FREELANCE
  deliverableUrl?: string; // For FREELANCE
  trackingNumber?: string; // For MARKETPLACE
}

export interface DisputeEscrowRequest {
  reason: string;
  disputer: string; // buyer or seller address
}

export interface ArbitrateRequest {
  releaseToSeller: boolean;
  note: string;
}

export const getStateLabel = (state: EscrowState): string => {
  switch (state) {
    case EscrowState.CREATED:
      return 'Created';
    case EscrowState.FUNDED:
      return 'Funded';
    case EscrowState.DELIVERED:
      return 'Delivered';
    case EscrowState.COMPLETED:
      return 'Completed';
    case EscrowState.DISPUTED:
      return 'Disputed';
    case EscrowState.REFUNDED:
      return 'Refunded';
    case EscrowState.EXPIRED:
      return 'Expired';
    default:
      return 'Unknown';
  }
};

export const getTypeLabel = (type: EscrowType): string => {
  switch (type) {
    case EscrowType.MARKETPLACE:
      return 'Marketplace';
    case EscrowType.P2P:
      return 'Peer-to-Peer';
    case EscrowType.FREELANCE:
      return 'Freelance';
    default:
      return 'Unknown';
  }
};
