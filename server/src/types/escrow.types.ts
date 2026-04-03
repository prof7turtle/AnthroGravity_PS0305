export type EscrowMode = 0 | 1 | 2;

export type EscrowStateName =
  | 'CREATED'
  | 'FUNDED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'EXPIRED';

export interface CreateEscrowRequest {
  sellerAddress: string;
  buyerAddress: string;
  itemName: string;
  escrowType: 'MARKETPLACE' | 'P2P' | 'FREELANCE';
  deadlineHours: number;
  amount: number;
  currency?: string;
  requirements?: string[];
  webhookUrl?: string;
}

export interface CreateEscrowSpecResponse {
  appId: number | null;
  escrowAddress: string;
  txId: string;
  loraUrl: string;
}

export interface FundEscrowSpecResponse {
  unsignedTxns: string[];
  unsignedTransaction: string;
  escrowId: string;
  amountMicroAlgo: number;
  receiver: string;
}

export interface TxHistoryItem {
  action: string;
  fromState: string;
  toState: string;
  actor: string;
  txId: string;
  note: string;
  createdAt?: string;
}
