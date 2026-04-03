import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type EscrowState = 'CREATED' | 'FUNDED' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED' | 'EXPIRED';
export type EscrowType = 'MARKETPLACE' | 'P2P' | 'FREELANCE';

export interface EscrowRecord {
  _id: string;
  escrowId: string;
  state: EscrowState;
  escrowType: EscrowType;
  itemName: string;
  amount: number;
  currency: string;
  buyerAddress: string;
  sellerAddress: string;
  deadlineAt: string;
  hasSubmission: boolean;
  isAiRunning: boolean;
  aiScore: number | null;
  aiVerdict: {
    score: number | null;
    matched: string[];
    gaps: string[];
    verdict: string;
    recommendation: 'RELEASE' | 'DISPUTE' | '';
  };
  requirements: string[];
  deliverablesHash: string;
  txIds: {
    create: string;
    fund: string;
    submit: string;
    verify: string;
    release: string;
    dispute: string;
    refund: string;
  };
  activityLogs: Array<{
    action: string;
    fromState: string;
    toState: string;
    actor: string;
    txId: string;
    note: string;
    createdAt?: string;
  }>;
}

export const createEscrow = async (payload: {
  sellerAddress: string;
  buyerAddress?: string;
  itemName: string;
  escrowType: EscrowType;
  amount: number;
  currency: string;
  deadlineHours: number;
  requirements: string[];
}) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/create`, payload);
  return res.data;
};

export const getEscrow = async (id: string) => {
  const res = await axios.get<EscrowRecord>(`${API_BASE}/api/escrow/${id}`);
  return res.data;
};

export const fundEscrow = async (id: string, payload: { buyerAddress: string; amount?: number }) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/fund`, payload);
  return res.data;
};

export const submitEscrowWork = async (
  id: string,
  payload: { sellerAddress: string; githubUrl?: string; description?: string; liveUrl?: string; notes?: string },
) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/submit`, payload);
  return res.data;
};

export const verifyEscrow = async (id: string, payload?: { score?: number }) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/verify`, payload ?? {});
  return res.data;
};

export const deliverEscrow = async (id: string, payload?: { actor?: string }) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/deliver`, payload ?? {});
  return res.data;
};

export const disputeEscrow = async (id: string, payload?: { actor?: string }) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/dispute`, payload ?? {});
  return res.data;
};

export const refundEscrow = async (id: string, payload?: { actor?: string }) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/refund`, payload ?? {});
  return res.data;
};

export const resolveEscrow = async (
  id: string,
  payload: { releaseToSeller: boolean; actor?: string },
) => {
  const res = await axios.post<EscrowRecord>(`${API_BASE}/api/escrow/${id}/resolve`, payload);
  return res.data;
};
