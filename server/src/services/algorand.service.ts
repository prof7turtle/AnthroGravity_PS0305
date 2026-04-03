import {
  buildUnsignedFundingTransaction,
  findFundingTransaction,
  verifyAlgorandTransactionWithRetry,
} from '../utils/algorand';

const TESTNET_EXPLORER_BASE = 'https://testnet.algoexplorer.io';
const LORA_BASE = 'https://lora.algokit.io/testnet';

export const toTransactionExplorerUrl = (txId: string) => `${TESTNET_EXPLORER_BASE}/tx/${txId}`;
export const toLoraAppUrl = (appId: number | null | undefined) => (appId ? `${LORA_BASE}/application/${appId}` : '');

export const prepareFundingTransaction = async (params: {
  sender: string;
  receiver: string;
  amount: number;
  escrowId: string;
}) => {
  return buildUnsignedFundingTransaction({
    sender: params.sender,
    receiver: params.receiver,
    amount: params.amount,
    note: `escrow:${params.escrowId}:fund`,
  });
};

export const verifyFundingTransaction = async (txId: string) => {
  return verifyAlgorandTransactionWithRetry(txId, 5, 1400);
};

export const discoverFundingTransaction = async (params: {
  sender: string;
  receiver: string;
  amount: number;
}) => {
  return findFundingTransaction({
    sender: params.sender,
    receiver: params.receiver,
    amount: params.amount,
    maxResults: 30,
  });
};
