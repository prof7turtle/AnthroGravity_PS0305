import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import {
  confirmEscrowFund,
  deliverEscrow,
  disputeEscrow,
  getEscrow,
  requestFundEscrowTransaction,
  type EscrowRecord,
} from '../lib/escrowApi';

type EscrowView = EscrowRecord & {
  appId: number | null;
};

type FundingPreview = {
  receiver: string;
  amount: number;
  unsignedTransactions: string[];
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const toEscrowView = (payload: unknown): EscrowView | null => {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const raw = (root._doc && typeof root._doc === 'object' ? root._doc : root) as Record<string, unknown>;

  const aiVerdictRaw = (raw.aiVerdict && typeof raw.aiVerdict === 'object' ? raw.aiVerdict : {}) as Record<string, unknown>;
  const txIdsRaw = (raw.txIds && typeof raw.txIds === 'object' ? raw.txIds : {}) as Record<string, unknown>;

  return {
    _id: String(raw._id || ''),
    escrowId: String(raw.escrowId || ''),
    state: String(raw.state || 'CREATED') as EscrowRecord['state'],
    escrowType: String(raw.escrowType || 'FREELANCE') as EscrowRecord['escrowType'],
    itemName: String(raw.itemName || 'Untitled Escrow'),
    amount: Number(raw.amount || 0),
    currency: String(raw.currency || 'ALGO'),
    buyerAddress: String(raw.buyerAddress || ''),
    sellerAddress: String(raw.sellerAddress || ''),
    deadlineAt: String(raw.deadlineAt || ''),
    hasSubmission: Boolean(raw.hasSubmission),
    isAiRunning: Boolean(raw.isAiRunning),
    aiScore: raw.aiScore === null || raw.aiScore === undefined ? null : Number(raw.aiScore),
    aiRawOutput: String(raw.aiRawOutput || ''),
    aiVerdict: {
      score: aiVerdictRaw.score === null || aiVerdictRaw.score === undefined ? null : Number(aiVerdictRaw.score),
      matched: normalizeStringArray(aiVerdictRaw.matched),
      gaps: normalizeStringArray(aiVerdictRaw.gaps),
      verdict: String(aiVerdictRaw.verdict || ''),
      recommendation: (String(aiVerdictRaw.recommendation || '') as 'RELEASE' | 'DISPUTE' | ''),
    },
    requirements: normalizeStringArray(raw.requirements),
    deliverablesHash: String(raw.deliverablesHash || ''),
    txIds: {
      create: String(txIdsRaw.create || ''),
      fund: String(txIdsRaw.fund || ''),
      submit: String(txIdsRaw.submit || ''),
      verify: String(txIdsRaw.verify || ''),
      release: String(txIdsRaw.release || ''),
      dispute: String(txIdsRaw.dispute || ''),
      refund: String(txIdsRaw.refund || ''),
    },
    activityLogs: Array.isArray(raw.activityLogs)
      ? raw.activityLogs
          .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
          .map((entry) => ({
            action: String(entry.action || ''),
            fromState: String(entry.fromState || ''),
            toState: String(entry.toState || ''),
            actor: String(entry.actor || ''),
            txId: String(entry.txId || ''),
            note: String(entry.note || ''),
            createdAt: entry.createdAt ? String(entry.createdAt) : undefined,
          }))
      : [],
    appId: typeof raw.appId === 'number' ? raw.appId : null,
  };
};

const badgeClassByState: Record<EscrowRecord['state'], string> = {
  CREATED: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  FUNDED: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
  COMPLETED: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  DISPUTED: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
  REFUNDED: 'bg-slate-400/20 text-slate-100 border-slate-300/40',
  EXPIRED: 'bg-zinc-500/20 text-zinc-200 border-zinc-300/40',
};

const truncateAddress = (value: string) => {
  if (!value) return '-';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
};

const formatAlgoFromMicro = (microAlgo: number): string => {
  const algo = Number(microAlgo || 0) / 1_000_000;
  return algo.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
};

const explainAlgodError = (message: string): string => {
  const minBalanceMatch = message.match(/balance\s+(\d+)\s+below\s+min\s+(\d+)/i);
  if (!minBalanceMatch) return message;

  const balance = Number(minBalanceMatch[1] || 0);
  const minBalance = Number(minBalanceMatch[2] || 0);
  const shortfall = Math.max(0, minBalance - balance);

  return [
    'Insufficient spendable ALGO due to Algorand minimum balance reserve.',
    `Wallet balance: ${formatAlgoFromMicro(balance)} ALGO (${balance.toLocaleString()} microALGO).`,
    `Required minimum reserve: ${formatAlgoFromMicro(minBalance)} ALGO (${minBalance.toLocaleString()} microALGO).`,
    `Add at least ${formatAlgoFromMicro(shortfall)} ALGO more (plus a small fee buffer), then retry.`,
  ].join(' ');
};

const EscrowDetail = () => {
  const { appId } = useParams<{ appId: string }>();
  const { activeAddress, signTransactions, algodClient } = useWallet();
  const [escrow, setEscrow] = useState<EscrowView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [busyAction, setBusyAction] = useState<'fund' | 'deliver' | 'dispute' | ''>('');
  const [buyerAddressInput, setBuyerAddressInput] = useState('');
  const [fundingPreview, setFundingPreview] = useState<FundingPreview | null>(null);

  const routeId = appId ? appId.trim() : '';

  const effectiveEscrowId = useMemo(() => {
    if (!escrow) return routeId;
    return escrow.escrowId || routeId;
  }, [escrow, routeId]);

  const loraUrl = useMemo(() => {
    if (!escrow?.appId) return '';
    const network = (import.meta.env.VITE_ALGORAND_NETWORK || 'testnet').toLowerCase();
    return `https://lora.algokit.io/${network}/application/${escrow.appId}`;
  }, [escrow?.appId]);

  const loadEscrow = async () => {
    if (!routeId) {
      setError('Escrow ID is missing in the URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await getEscrow(routeId);
      const normalized = toEscrowView(response);
      if (!normalized) {
        throw new Error('Invalid escrow response from server');
      }
      setEscrow(normalized);
      setBuyerAddressInput(normalized.buyerAddress || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load escrow details');
      setEscrow(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEscrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  useEffect(() => {
    if (!buyerAddressInput && activeAddress) {
      setBuyerAddressInput(activeAddress);
    }
  }, [activeAddress, buyerAddressInput]);

  const runAction = async (
    action: 'fund' | 'deliver' | 'dispute',
    task: () => Promise<void>,
    successMessage: string,
  ) => {
    setActionError('');
    setActionStatus('');
    setBusyAction(action);
    try {
      await task();
      setActionStatus(successMessage);
      await loadEscrow();
    } catch (err) {
      const rawError = err instanceof Error ? err.message : 'Action failed';
      setActionError(explainAlgodError(rawError));
    } finally {
      setBusyAction('');
    }
  };

  const handleFund = async () => {
    if (!effectiveEscrowId) return;
    await runAction(
      'fund',
      async () => {
        const buyerAddress = buyerAddressInput.trim() || activeAddress || '';
        if (!buyerAddress) throw new Error('Buyer address is required to prepare funding transaction');
        if (!activeAddress) throw new Error('Connect wallet before funding');

        const preparedPayload = await requestFundEscrowTransaction(effectiveEscrowId, { buyerAddress }) as {
          receiver?: string;
          amount?: number;
          unsignedTransaction?: string;
          unsignedTxns?: string[];
          unsignedTransactions?: string[];
        };

        const unsignedCandidates = Array.isArray(preparedPayload?.unsignedTxns) && preparedPayload.unsignedTxns.length > 0
          ? preparedPayload.unsignedTxns
          : Array.isArray(preparedPayload?.unsignedTransactions) && preparedPayload.unsignedTransactions.length > 0
            ? preparedPayload.unsignedTransactions
            : preparedPayload?.unsignedTransaction
              ? [preparedPayload.unsignedTransaction]
              : [];

        // Some API variants expose both unsignedTransaction and unsignedTxns for the same txn.
        // Dedupe here to avoid accidentally submitting an ungrouped duplicate as a 2-txn group.
        const unsignedTxnsRaw = Array.from(new Set(
          unsignedCandidates.filter((txn): txn is string => typeof txn === 'string' && txn.length > 0),
        ));

        if (unsignedTxnsRaw.length === 0) {
          throw new Error('Backend did not return unsigned transactions');
        }

        const decodedTransactions = unsignedTxnsRaw.map((encoded: string) => {
          const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
          return algosdk.decodeUnsignedTransaction(bytes);
        });

        const signedResult = await signTransactions(decodedTransactions as any);

        const candidateBlobs: unknown[] = Array.isArray(signedResult?.[0])
          ? (signedResult[0] as unknown[])
          : (signedResult as unknown[]);

        const signedTxns = candidateBlobs
          .map((blob): Uint8Array | null => {
            if (blob instanceof Uint8Array) return blob;
            if (typeof blob === 'string' && blob.length > 0) {
              return Uint8Array.from(atob(blob), (char) => char.charCodeAt(0));
            }
            return null;
          })
          .filter((blob): blob is Uint8Array => blob instanceof Uint8Array);

        if (!signedTxns.length) {
          throw new Error('Wallet did not return signed transactions');
        }

        const submitInput: Uint8Array | Uint8Array[] = signedTxns.length === 1 ? signedTxns[0] : signedTxns;
        const submitPayload = await algodClient.sendRawTransaction(submitInput).do();
        await algosdk.waitForConfirmation(algodClient, submitPayload.txid, 4);
        await confirmEscrowFund(effectiveEscrowId, { txId: submitPayload.txid });

        setFundingPreview({
          receiver: preparedPayload?.receiver || '',
          amount: Number(preparedPayload?.amount || 0),
          unsignedTransactions: unsignedTxnsRaw,
        });
        const txId = submitPayload?.txid;
        if (txId) {
          setActionStatus(`Funding submitted successfully. Tx: ${txId}`);
        }
      },
      'Funding transaction signed and submitted.',
    );
  };

  const handleDeliver = async () => {
    if (!effectiveEscrowId) return;
    await runAction(
      'deliver',
      async () => {
        await deliverEscrow(effectiveEscrowId, { actor: 'buyer-ui' });
      },
      'Delivery confirmation submitted.',
    );
  };

  const handleDispute = async () => {
    if (!effectiveEscrowId) return;
    await runAction(
      'dispute',
      async () => {
        await disputeEscrow(effectiveEscrowId, { actor: 'buyer-ui' });
      },
      'Dispute raised successfully.',
    );
  };

  return (
    <section className="min-h-screen bg-[#0a0a0c] px-6 pb-20 pt-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-2xl border border-white/10 bg-linear-to-br from-[#171720] via-[#121219] to-[#0d0d12] p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-white/50">Escrow Overview</p>
          <h1 className="mt-2 font-['Outfit'] text-3xl font-extrabold">Escrow {routeId || '-'}</h1>
          <p className="mt-2 text-sm text-white/60">Track lifecycle state, run key actions, and jump to LORA explorer.</p>
        </header>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/75">Loading escrow details...</div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
            Failed to load escrow: {error}
          </div>
        )}

        {!loading && !error && escrow && (
          <div className="space-y-6">
            <article className="grid gap-4 rounded-2xl border border-white/10 bg-[#101016] p-6 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">State</p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${badgeClassByState[escrow.state]}`}
                >
                  {escrow.state}
                </span>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Escrow Type</p>
                <p className="mt-2 text-sm font-semibold text-white">{escrow.escrowType}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Buyer</p>
                <p className="mt-2 text-sm font-medium text-white">{truncateAddress(escrow.buyerAddress)}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Seller</p>
                <p className="mt-2 text-sm font-medium text-white">{truncateAddress(escrow.sellerAddress)}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Amount</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {escrow.currency === 'ALGO'
                    ? `${formatAlgoFromMicro(escrow.amount)} ALGO`
                    : `${escrow.amount.toLocaleString()} ${escrow.currency}`}
                </p>
                {escrow.currency === 'ALGO' && (
                  <p className="mt-1 text-xs text-white/55">{escrow.amount.toLocaleString()} microALGO</p>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Escrow ID</p>
                <p className="mt-2 text-sm font-mono text-white">{escrow.escrowId || '-'}</p>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-widest text-white/50">LORA</p>
                {loraUrl ? (
                  <a
                    href={loraUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-cyan-300 underline underline-offset-4"
                  >
                    Open in LORA Explorer
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-white/60">LORA link is unavailable until appId is set.</p>
                )}
              </div>

              {escrow.state === 'CREATED' && (
                <p className="md:col-span-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  On-chain app is initialized. Buyer and amount will move from default values to funded values after you sign and submit the Fund transaction group.
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#11111a] p-6">
              <h2 className="font-['Outfit'] text-2xl font-bold">Actions</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/55">
                    Buyer Address (for Fund)
                  </label>
                  <input
                    value={buyerAddressInput}
                    onChange={(event) => setBuyerAddressInput(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/70"
                    placeholder="Paste buyer Algorand address"
                  />
                  <button
                    onClick={() => void handleFund()}
                    disabled={busyAction !== '' || escrow.state !== 'CREATED'}
                    className="mt-3 w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === 'fund' ? 'Preparing...' : 'Fund'}
                  </button>
                </div>

                <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <button
                    onClick={() => void handleDeliver()}
                    disabled={busyAction !== '' || escrow.state !== 'FUNDED'}
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === 'deliver' ? 'Submitting...' : 'Confirm Delivery'}
                  </button>

                  <button
                    onClick={() => void handleDispute()}
                    disabled={busyAction !== '' || escrow.state !== 'FUNDED'}
                    className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === 'dispute' ? 'Submitting...' : 'Dispute'}
                  </button>
                </div>
              </div>

              {actionStatus && (
                <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  {actionStatus}
                </p>
              )}

              {actionError && (
                <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                  {actionError}
                </p>
              )}

              {fundingPreview && (
                <div className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-widest text-cyan-200/80">Funding Transaction Preview</p>
                  <p className="mt-2 text-sm text-cyan-100">Receiver: {fundingPreview.receiver}</p>
                  <p className="mt-1 text-sm text-cyan-100">Amount (microALGO): {fundingPreview.amount}</p>
                  {fundingPreview.unsignedTransactions.map((txn, index) => (
                    <p key={index} className="mt-2 break-all font-mono text-xs text-cyan-100/90">
                      Txn {index + 1}: {txn}
                    </p>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0f0f15] p-6">
              <h2 className="font-['Outfit'] text-2xl font-bold">Recent Activity</h2>
              {escrow.activityLogs.length === 0 ? (
                <p className="mt-3 text-sm text-white/60">No activity yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {escrow.activityLogs.slice().reverse().map((entry, index) => (
                    <div key={`${entry.txId}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-sm font-semibold text-white">{entry.action || 'Unknown action'}</p>
                      <p className="mt-1 text-xs text-white/65">{entry.note || '-'}</p>
                      <p className="mt-1 text-[11px] text-white/50">Tx: {entry.txId || '-'}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <div className="flex gap-3">
              <button
                onClick={() => void loadEscrow()}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Refresh
              </button>
              <Link
                to="/marketplace"
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Back to Marketplace
              </Link>
              <Link
                to="/my-escrows"
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                View My Escrows
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default EscrowDetail;
