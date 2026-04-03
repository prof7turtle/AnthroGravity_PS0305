import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGORAND_ALGOD_URL || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = process.env.ALGORAND_ALGOD_TOKEN || '';
const INDEXER_URL = process.env.ALGORAND_INDEXER_URL || 'https://testnet-idx.algonode.cloud';
const INDEXER_TOKEN = process.env.ALGORAND_INDEXER_TOKEN || '';

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');
const indexerClient = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_URL, '');

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type VerifiedPaymentTransaction = {
  txId: string;
  sender: string;
  receiver: string;
  amount: number;
  confirmedRound: number | null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseVerifiedPayment = (txId: string, transaction: any): VerifiedPaymentTransaction => {
  const payment = transaction?.paymentTransaction || transaction?.['payment-transaction'];
  if (!payment) {
    throw new Error('Transaction is not an Algorand payment transaction');
  }

  const sender = transaction.sender || transaction.txn?.snd;
  const receiver = payment.receiver || payment.rcv;
  const amountRaw = payment.amount ?? payment.amt;

  if (!sender || !receiver || amountRaw === undefined || amountRaw === null) {
    throw new Error('Payment transaction fields are incomplete');
  }

  return {
    txId,
    sender: String(sender),
    receiver: String(receiver),
    amount: Number(amountRaw),
    confirmedRound: toNumberOrNull(transaction.confirmedRound ?? transaction['confirmed-round']),
  };
};

export const buildUnsignedFundingTransaction = async (params: {
  sender: string;
  receiver: string;
  amount: number;
  note?: string;
}) => {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const noteBytes = params.note ? new Uint8Array(Buffer.from(params.note, 'utf-8')) : undefined;

  const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: params.sender,
    receiver: params.receiver,
    amount: params.amount,
    note: noteBytes,
    suggestedParams,
  });

  const encoded = algosdk.encodeUnsignedTransaction(transaction);
  return {
    unsignedTransaction: Buffer.from(encoded).toString('base64'),
  };
};

export const verifyAlgorandTransaction = async (txId: string): Promise<VerifiedPaymentTransaction> => {
  const lookup = await indexerClient.lookupTransactionByID(txId).do();
  const transaction = lookup.transaction;

  if (!transaction) {
    throw new Error('Transaction not found on indexer');
  }

  return parseVerifiedPayment(txId, transaction);
};

export const verifyAlgorandTransactionWithRetry = async (
  txId: string,
  retries = 5,
  delayMs = 1400,
): Promise<VerifiedPaymentTransaction> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await verifyAlgorandTransaction(txId);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries - 1) {
        await sleep(delayMs);
      }
    }
  }

  try {
    const pending: any = await algodClient.pendingTransactionInformation(txId).do();
    if (pending?.confirmedRound || pending?.['confirmed-round']) {
      return parseVerifiedPayment(txId, pending);
    }
  } catch {
    // ignore fallback errors and throw original verification failure
  }

  throw lastError || new Error('Transaction not found on indexer/algod');
};

export const findFundingTransaction = async (params: {
  sender: string;
  receiver: string;
  amount: number;
  maxResults?: number;
}) => {
  const max = Math.min(params.maxResults || 25, 50);
  const lookup: any = await indexerClient
    .searchForTransactions()
    .address(params.sender)
    .addressRole('sender')
    .txType('pay')
    .limit(max)
    .do();

  const transactions = Array.isArray(lookup?.transactions) ? lookup.transactions : [];
  for (const transaction of transactions) {
    try {
      const parsed = parseVerifiedPayment(transaction.id || '', transaction);
      if (
        parsed.sender.toUpperCase() === params.sender.toUpperCase()
        && parsed.receiver.toUpperCase() === params.receiver.toUpperCase()
        && Number(parsed.amount) === Number(params.amount)
      ) {
        return parsed;
      }
    } catch {
      // skip non-payment or malformed records
    }
  }

  return null;
};

export const isValidAlgorandAddress = (address: string) => {
  return algosdk.isValidAddress(address);
};
