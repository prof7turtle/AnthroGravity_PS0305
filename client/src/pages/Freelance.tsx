import { useEffect, useState } from 'react';
import algosdk from 'algosdk';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  confirmEscrowFund,
  createEscrow,
  deliverEscrow,
  disputeEscrow,
  getEscrow,
  refundEscrow,
  requestFundEscrowTransaction,
  submitEscrowWork,
  withdrawDisputeEscrow,
  verifyEscrow,
} from '../lib/escrowApi';
import type { EscrowRecord } from '../lib/escrowApi';

// ─── Blockchain States (from smart contract) ────────────────────────────
type BlockchainState = 'CREATED' | 'FUNDED' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED' | 'EXPIRED';

// ─── Derived UI States (computed from blockchain state + off-chain data) ─
type DerivedUIStatus =
  | 'AWAITING_FUNDING'   // CREATED — waiting for client to fund
  | 'IN_PROGRESS'        // FUNDED + no submission yet
  | 'SUBMITTED'          // FUNDED + freelancer submitted deliverables
  | 'VERIFYING'          // FUNDED + AI evaluation in progress
  | 'VERIFIED'           // AI approved, contract about to move to COMPLETED
  | 'PAYMENT_RELEASED'   // COMPLETED — funds released to freelancer
  | 'UNDER_DISPUTE'      // DISPUTED — AI rejected or client disputed
  | 'REFUNDED'           // REFUNDED — funds returned to client
  | 'EXPIRED';           // EXPIRED — deadline passed

type ViewMode = 'client' | 'freelancer';

// ─── Mock Escrow Data ────────────────────────────────────────────────────
interface EscrowData {
  id: string;
  title: string;
  clientAddr: string;
  freelancerAddr: string;
  amount: number;
  currency: string;
  deadline: string;
  requirements: string[];
  aiCriteria: string;
  blockchainState: BlockchainState;
  hasSubmission: boolean;
  isAiRunning: boolean;
  aiScore: number | null;
  aiVerdict: {
    matched: string[];
    gaps: string[];
    score: number;
    verdict: string;
    recommendation: 'RELEASE' | 'DISPUTE' | '';
  } | null;
  aiRawOutput: string;
  verifyTxId: string;
}

const INITIAL_ESCROW: EscrowData = {
  id: 'AE-8842-X',
  title: 'React Native Wallet Integration',
  clientAddr: '0x4F...8a9C',
  freelancerAddr: '0x9B...1f4D',
  amount: 2500,
  currency: 'USDC',
  deadline: '2026-04-10T00:00:00Z',
  requirements: [
    'Must use AlgoKit Utils TypeScript SDK',
    'Must successfully sign and send a 0-ALGO transaction',
    'Code must have 100% test coverage using vitest',
  ],
  aiCriteria: 'Claude API will clone the submitted GitHub repo, check for algokit-utils in package.json, run "npm test", and statically analyze the code for a wallet connection method.',
  blockchainState: 'CREATED',
  hasSubmission: false,
  isAiRunning: false,
  aiScore: null,
  aiVerdict: null,
  aiRawOutput: '',
  verifyTxId: '',
};

const DEMO_ESCROW_STORAGE_KEY = 'algoescrow_workflows_id';

const mapEscrowToView = (record: EscrowRecord): EscrowData => ({
  id: record.escrowId,
  title: record.itemName,
  clientAddr: record.buyerAddress || 'Pending funding',
  freelancerAddr: record.sellerAddress,
  amount: record.amount,
  currency: record.currency,
  deadline: record.deadlineAt,
  requirements: record.requirements.length
    ? record.requirements
    : [
        'Must use AlgoKit Utils TypeScript SDK',
        'Must successfully sign and send a 0-ALGO transaction',
        'Code must have 100% test coverage using vitest',
      ],
  aiCriteria:
    'The verification engine checks submitted deliverables against requirements and returns a score plus release/dispute recommendation.',
  blockchainState: record.state,
  hasSubmission: record.hasSubmission,
  isAiRunning: record.isAiRunning,
  aiScore: record.aiScore,
  aiVerdict:
    record.aiVerdict && record.aiVerdict.score !== null
      ? {
          matched: record.aiVerdict.matched,
          gaps: record.aiVerdict.gaps,
          score: record.aiVerdict.score,
          verdict: record.aiVerdict.verdict,
          recommendation: record.aiVerdict.recommendation,
        }
      : null,
  aiRawOutput: record.aiRawOutput || '',
  verifyTxId: record.txIds?.verify || '',
});

const toInlineAnalysis = (value: string, maxLen = 320) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Analysis completed, but no paragraph was returned.';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}...`;
};

// ─── Component ───────────────────────────────────────────────────────────
const Freelance = () => {
  const { activeAddress, signTransactions, algodClient } = useWallet();
  const [viewMode, setViewMode] = useState<ViewMode>('client');
  const [escrow, setEscrow] = useState<EscrowData>(INITIAL_ESCROW);
  const [escrowId, setEscrowId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');
  const [lastAnalysisAt, setLastAnalysisAt] = useState('');

  // Freelancer form
  const [repoUrl, setRepoUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [notes, setNotes] = useState('');

  const syncEscrow = async (id: string) => {
    const record = await getEscrow(id);
    setEscrow(mapEscrowToView(record));
    setEscrowId(record.escrowId);
    localStorage.setItem(DEMO_ESCROW_STORAGE_KEY, record.escrowId);
  };

  useEffect(() => {
    const boot = async () => {
      setServerError('');
      setServerMessage('');

      try {
        if (!activeAddress) {
          setServerMessage('Connect Pera wallet to initialize a buyer-locked escrow session.');
          return;
        }

        const storedId = localStorage.getItem(DEMO_ESCROW_STORAGE_KEY);
        if (storedId) {
          try {
            await syncEscrow(storedId);
            return;
          } catch {
            localStorage.removeItem(DEMO_ESCROW_STORAGE_KEY);
          }
        }

        const created = await createEscrow({
          sellerAddress: activeAddress,
          buyerAddress: activeAddress,
          itemName: INITIAL_ESCROW.title,
          escrowType: 'FREELANCE',
          amount: INITIAL_ESCROW.amount,
          currency: INITIAL_ESCROW.currency,
          deadlineHours: 72,
          requirements: INITIAL_ESCROW.requirements,
        });

        setEscrow(mapEscrowToView(created));
        setEscrowId(created.escrowId);
        localStorage.setItem(DEMO_ESCROW_STORAGE_KEY, created.escrowId);
        setServerMessage('Escrow session initialized from server.');
      } catch (err: any) {
        setServerError(err?.response?.data?.message || 'Failed to initialize escrow session from server.');
      }
    };

    void boot();
  }, [activeAddress]);

  // ─── Derive UI status from blockchain state + off-chain data ─────────
  const deriveUIStatus = (): DerivedUIStatus => {
    switch (escrow.blockchainState) {
      case 'CREATED':
        return 'AWAITING_FUNDING';
      case 'FUNDED':
        if (escrow.isAiRunning) return 'VERIFYING';
        if (escrow.aiScore !== null && escrow.aiScore >= 75) return 'VERIFIED';
        if (escrow.hasSubmission) return 'SUBMITTED';
        return 'IN_PROGRESS';
      case 'COMPLETED':
        return 'PAYMENT_RELEASED';
      case 'DISPUTED':
        return 'UNDER_DISPUTE';
      case 'REFUNDED':
        return 'REFUNDED';
      case 'EXPIRED':
        return 'EXPIRED';
    }
  };

  const uiStatus = deriveUIStatus();

  // ─── Actions ─────────────────────────────────────────────────────────
  const handleFundEscrow = async () => {
    if (!escrowId || isBusy) return;

    if (!activeAddress) {
      setServerError('Connect your Pera wallet before funding escrow.');
      return;
    }

    setIsBusy(true);
    setServerError('');

    try {
      const actor = activeAddress;

      const accountInfo = await algodClient.accountInformation(actor).do();
      const walletBalance = Number(accountInfo?.amount || 0);
      const estimatedFeeBuffer = 2000;
      const requiredBalance = Number(escrow.amount) + estimatedFeeBuffer;
      if (walletBalance < requiredBalance) {
        setServerError(
          `Insufficient TestNet ALGO balance. Wallet has ${walletBalance} microALGO, requires at least ${requiredBalance} microALGO. Fund your wallet from Algorand TestNet faucet and retry.`,
        );
        return;
      }

      const prepared = await requestFundEscrowTransaction(escrowId, { buyerAddress: actor });

      const unsignedTransactionBytes = Uint8Array.from(atob(prepared.unsignedTransaction), (char) => char.charCodeAt(0));
      const unsignedTransaction = algosdk.decodeUnsignedTransaction(unsignedTransactionBytes);
      const unsignedSender = unsignedTransaction.sender.toString();
      if (unsignedSender !== actor) {
        setServerError(
          `Wallet/account mismatch detected. Connected account: ${actor}, transaction sender: ${unsignedSender}. Disconnect and reconnect Pera with the correct account, then retry.`,
        );
        return;
      }

      const signedTransactions = await signTransactions([unsignedTransaction]);
      const signedBlob = signedTransactions[0];

      if (!signedBlob) {
        throw new Error('Wallet did not return a signed transaction.');
      }

      const sendResult = await algodClient.sendRawTransaction(signedBlob).do();
      await algosdk.waitForConfirmation(algodClient, sendResult.txid, 4);

      const updated = await confirmEscrowFund(escrowId, { txId: sendResult.txid });
      setEscrow(mapEscrowToView(updated));
      setServerMessage(
        `Escrow funded and verified. Tx: ${updated.txIds.fund} | Explorer: https://testnet.algoexplorer.io/tx/${updated.txIds.fund}`,
      );
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const backendError = err?.response?.data?.error;
      const clientMessage = err?.message ? String(err.message) : '';
      setServerError(
        backendMessage
          ? `${backendMessage}${backendError ? ` (${backendError})` : ''}`
          : clientMessage || 'Failed to fund escrow.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!escrowId || isBusy) return;
    setIsBusy(true);
    setServerError('');

    try {
      const actor = localStorage.getItem('algoescrow_activeAddress') || escrow.freelancerAddr;
      await submitEscrowWork(escrowId, {
        sellerAddress: actor,
        githubUrl: repoUrl,
        liveUrl,
        notes,
        description: notes || 'Deliverables submitted from workflows page',
      });
      const verified = await verifyEscrow(escrowId);
      setEscrow(mapEscrowToView(verified));
      setLastAnalysisAt(new Date().toISOString());
      const analysisPreview = toInlineAnalysis(verified.aiVerdict?.verdict || '');
      setServerMessage(
        `Analysis complete: ${analysisPreview}`,
      );
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const backendError = err?.response?.data?.error;
      setServerError(
        backendMessage
          ? `${backendMessage}${backendError ? ` (${backendError})` : ''}`
          : 'Failed to submit and verify deliverables.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleAnalyzeNow = async () => {
    if (!escrowId || isBusy) return;

    if (escrow.blockchainState !== 'FUNDED') {
      setServerError('AI verification can only run while escrow is in FUNDED state.');
      return;
    }

    if (!escrow.hasSubmission) {
      setServerError('Submit deliverables before running AI verification.');
      return;
    }

    setIsBusy(true);
    setServerError('');

    try {
      const verified = await verifyEscrow(escrowId);
      setEscrow(mapEscrowToView(verified));
      setLastAnalysisAt(new Date().toISOString());
      const analysisPreview = toInlineAnalysis(verified.aiVerdict?.verdict || '');
      setServerMessage(
        `Analyze Now complete: ${analysisPreview}`,
      );
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const backendError = err?.response?.data?.error;
      setServerError(
        backendMessage
          ? `${backendMessage}${backendError ? ` (${backendError})` : ''}`
          : 'Failed to run AI verification.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleClientConfirm = async () => {
    if (!escrowId || isBusy) return;
    setIsBusy(true);
    setServerError('');

    try {
      const actor = localStorage.getItem('algoescrow_activeAddress') || 'DEMO-BUYER-ALGO-ADDR';
      const updated = await deliverEscrow(escrowId, { actor });

      setEscrow(mapEscrowToView(updated));
      setServerMessage(`Escrow moved to ${updated.state}. Tx: ${updated.txIds.release}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Failed to confirm delivery.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleWithdrawDispute = async () => {
    if (!escrowId || isBusy) return;
    setIsBusy(true);
    setServerError('');

    try {
      const actor = localStorage.getItem('algoescrow_activeAddress') || 'DEMO-BUYER-ALGO-ADDR';
      const updated = await withdrawDisputeEscrow(escrowId, { actor });
      setEscrow(mapEscrowToView(updated));
      setServerMessage('Dispute withdrawn. Escrow remains funded and no release was executed.');
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Failed to withdraw dispute.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAskRefund = async () => {
    if (!escrowId || isBusy) return;
    setIsBusy(true);
    setServerError('');

    try {
      const actor = localStorage.getItem('algoescrow_activeAddress') || 'DEMO-BUYER-ALGO-ADDR';
      const updated = await refundEscrow(escrowId, { actor });
      setEscrow(mapEscrowToView(updated));
      setServerMessage(`Refund requested and executed. Tx: ${updated.txIds.refund}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Failed to request refund.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleClientDispute = async () => {
    if (!escrowId || isBusy) return;
    setIsBusy(true);
    setServerError('');

    try {
      const actor = localStorage.getItem('algoescrow_activeAddress') || 'DEMO-BUYER-ALGO-ADDR';
      const updated = await disputeEscrow(escrowId, { actor });
      setEscrow(mapEscrowToView(updated));
      setServerMessage(`Dispute raised. Tx: ${updated.txIds.dispute}`);
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Failed to raise dispute.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetDemo = async () => {
    if (isBusy) return;

    if (!activeAddress) {
      setServerError('Connect Pera wallet before resetting escrow demo.');
      return;
    }

    setIsBusy(true);
    setServerError('');

    try {
      const created = await createEscrow({
        sellerAddress: activeAddress,
        buyerAddress: activeAddress,
        itemName: INITIAL_ESCROW.title,
        escrowType: 'FREELANCE',
        amount: INITIAL_ESCROW.amount,
        currency: INITIAL_ESCROW.currency,
        deadlineHours: 72,
        requirements: INITIAL_ESCROW.requirements,
      });

      setEscrow(mapEscrowToView(created));
      setEscrowId(created.escrowId);
      localStorage.setItem(DEMO_ESCROW_STORAGE_KEY, created.escrowId);
      setRepoUrl('');
      setLiveUrl('');
      setNotes('');
      setServerMessage('Demo reset complete with a fresh server escrow.');
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Failed to reset demo escrow.');
    } finally {
      setIsBusy(false);
    }
  };

  // ─── Badge Renderers ─────────────────────────────────────────────────
  const blockchainBadge = () => {
    const colors: Record<BlockchainState, string> = {
      CREATED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      FUNDED: 'bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/30',
      COMPLETED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      DISPUTED: 'bg-red-500/15 text-red-400 border-red-500/30',
      REFUNDED: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
      EXPIRED: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    };
    return (
      <span className={`${colors[escrow.blockchainState]} border px-3 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-widest font-mono`}>
        On-Chain: {escrow.blockchainState}
      </span>
    );
  };

  const uiStatusBadge = () => {
    const labels: Record<DerivedUIStatus, { text: string; cls: string }> = {
      AWAITING_FUNDING: { text: 'Awaiting Funding', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      IN_PROGRESS: { text: 'In Progress', cls: 'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20' },
      SUBMITTED: { text: 'Work Submitted', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
      VERIFYING: { text: 'AI Verifying', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse' },
      VERIFIED: { text: 'AI Approved', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      PAYMENT_RELEASED: { text: 'Payment Released', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      UNDER_DISPUTE: { text: 'Under Dispute', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
      REFUNDED: { text: 'Refunded', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      EXPIRED: { text: 'Expired', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
    };
    const { text, cls } = labels[uiStatus];
    return (
      <span className={`${cls} border px-3 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-widest`}>
        {text}
      </span>
    );
  };

  // ─── Allowed Actions Panel ────────────────────────────────────────────
  const getAllowedActions = (): string[] => {
    if (viewMode === 'client') {
      switch (escrow.blockchainState) {
        case 'CREATED': return ['fund'];
        case 'FUNDED':
          if (escrow.hasSubmission && !escrow.isAiRunning && escrow.aiScore !== null)
            return ['confirm', 'dispute'];
          return ['dispute'];
        case 'DISPUTED':
          return ['withdraw dispute', 'ask refund'];
        default: return [];
      }
    } else {
      switch (escrow.blockchainState) {
        case 'FUNDED':
          if (!escrow.hasSubmission) return ['submit work'];
          if (escrow.isAiRunning) return ['view analysis'];
          return ['update submission', 'analyze now'];
        default: return ['view status'];
      }
    }
  };

  const allowedActions = getAllowedActions();

  const aiAnalysisPanel = () => {
    const analysisParagraph = escrow.aiVerdict?.verdict?.trim()
      ? escrow.aiVerdict.verdict.trim()
      : escrow.hasSubmission
        ? 'Submission received. Run Analyze Now to generate the analysis paragraph.'
        : 'No deliverables submitted yet. Freelancer must submit work first.';

    return (
      <div className="bg-[#141418] border border-white/10 rounded-2xl p-5">
        <h3 className="text-base font-bold mb-3">Work Analysis</h3>
        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-[#d4d4d8] leading-relaxed m-0">
            {analysisParagraph}
          </p>
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto min-h-screen max-w-7xl overflow-x-hidden px-4 pb-20 pt-6 text-white font-['Inter'] sm:px-6 sm:pt-8 lg:px-8">

      {/* ═══ Demo Toolbar ═══ */}
      <div className="mb-8 flex flex-col gap-4 rounded-xl border border-[#a855f7]/30 bg-[#141418] p-4 shadow-[0_0_15px_rgba(168,85,247,0.1)] lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:w-auto">
          <h3 className="text-[#a855f7] font-bold text-sm tracking-widest uppercase mb-1">Interactive Demo Mode</h3>
          <p className="text-sm text-[#8a8a98] sm:text-base">Toggle between Client &amp; Freelancer to see role-based permissions and the escrow state machine in action.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:gap-3 lg:w-auto">
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/50 p-1 sm:w-auto sm:min-w-[24rem] sm:flex sm:gap-0">
            <button
              onClick={() => setViewMode('client')}
              className={`rounded-md px-3 py-2 text-sm font-bold transition-all sm:px-5 ${viewMode === 'client' ? 'bg-[#a855f7] text-white shadow-[0_0_14px_rgba(168,85,247,0.3)]' : 'text-[#8a8a98] hover:text-white'}`}
            >
              Client (User)
            </button>
            <button
              onClick={() => setViewMode('freelancer')}
              className={`rounded-md px-3 py-2 text-sm font-bold transition-all sm:px-5 ${viewMode === 'freelancer' ? 'bg-[#a855f7] text-white shadow-[0_0_14px_rgba(168,85,247,0.3)]' : 'text-[#8a8a98] hover:text-white'}`}
            >
              Freelancer (Merchant)
            </button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end sm:gap-3">
            <button onClick={handleResetDemo}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-[#8a8a98] transition-colors hover:text-white sm:w-auto"
            >
              Reset Demo
            </button>
            <button
              onClick={() => {
                if (!escrowId) return;
                void syncEscrow(escrowId);
                setServerError('');
                setServerMessage('Escrow refreshed from server.');
              }}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-[#8a8a98] transition-colors hover:text-white sm:w-auto"
            >
              Refresh Escrow
            </button>
          </div>
        </div>
      </div>

      {(serverMessage || serverError || isBusy) && (
        <div className="mb-6 space-y-2">
          {isBusy ? (
            <div className="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 px-4 py-2 text-xs font-semibold text-[#c084fc]">
              Syncing escrow state with server...
            </div>
          ) : null}
          {serverMessage ? (
            <div className="rounded-lg border border-[#a855f7]/20 bg-[#a855f7]/10 px-4 py-2 text-xs text-[#d9c5ff]">
              {serverMessage}
            </div>
          ) : null}
          {serverError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
              {serverError}
            </div>
          ) : null}
        </div>
      )}

      {/* ═══ Gig Header ═══ */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/5 bg-[#141418] p-5 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#a855f7]/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            {/* Dual Badge Row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[#8a8a98] font-mono text-xs">ESCROW #{escrow.id}</span>
              {blockchainBadge()}
              {uiStatusBadge()}
            </div>
            <h1 className="mb-2 font-['Outfit'] text-2xl font-extrabold sm:text-3xl md:text-4xl">{escrow.title}</h1>
            <p className="text-xs leading-relaxed text-[#8a8a98] sm:text-sm">
              <span className="block">
                Client: <span className="break-all text-white font-mono">{escrow.clientAddr}</span>
              </span>
              <span className="mt-1 block">
                Freelancer: <span className="break-all text-white font-mono">{escrow.freelancerAddr}</span>
              </span>
            </p>
          </div>

          {/* Locked Payment */}
          <div className="w-full rounded-xl border border-white/5 bg-black/40 p-4 text-left sm:w-auto sm:min-w-68 sm:p-5 lg:text-right">
            <div className="text-[#8a8a98] text-xs font-semibold mb-1 uppercase tracking-widest">
              {escrow.blockchainState === 'COMPLETED' ? 'Released Amount' : escrow.blockchainState === 'CREATED' ? 'Escrow Amount' : 'Locked Payment'}
            </div>
            <div className="text-2xl font-mono font-bold text-white sm:text-3xl">
              <span className="text-[#c084fc]">{escrow.amount.toLocaleString()}</span> {escrow.currency}
            </div>
            <div className="text-xs text-[#5a5a68] mt-1 font-mono">Deadline: {new Date(escrow.deadline).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Allowed Actions Strip */}
        <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-[#5a5a68] uppercase tracking-widest font-bold mr-2">
            Your Actions ({viewMode === 'client' ? 'Client' : 'Freelancer'}):
          </span>
          {allowedActions.length === 0 ? (
            <span className="text-xs text-[#5a5a68] italic">No actions available in current state</span>
          ) : (
            allowedActions.map((action) => (
              <span key={action} className="bg-white/5 border border-white/10 text-white text-xs font-mono px-3 py-1 rounded-lg">
                {action}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ═══ Main Grid ═══ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">

        {/* ─── Left Column: Requirements + State Machine ─── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Requirements */}
          <div className="bg-[#141418] border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-bold border-b border-white/5 pb-3 mb-4 font-['Outfit']">Gig Requirements</h2>
            <p className="text-sm text-[#8a8a98] leading-relaxed mb-4">
              Build a React Native component that connects to the Algorand blockchain using Pera Wallet.
            </p>
            <ul className="space-y-3">
              {escrow.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#d4d4d8]">
                  <span className="text-[#a855f7] mt-0.5 shrink-0">✓</span> {req}
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-5 border-t border-white/5">
              <h4 className="text-xs font-bold text-[#8a8a98] uppercase tracking-widest mb-2">AI Verification Criteria</h4>
              <div className="bg-black/30 p-3 rounded-lg border border-white/5 text-xs text-[#8a8a98] font-mono leading-relaxed">
                "{escrow.aiCriteria}"
              </div>
            </div>
          </div>

          {/* State Machine Visualization */}
          <div className="bg-[#141418] border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-bold border-b border-white/5 pb-3 mb-4 font-['Outfit']">Escrow State Machine</h2>
            <div className="space-y-1">
              {(['CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'EXPIRED'] as BlockchainState[]).map((state) => {
                const isActive = escrow.blockchainState === state;
                const isPast = (['CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'EXPIRED'] as BlockchainState[]).indexOf(escrow.blockchainState) >
                  (['CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'EXPIRED'] as BlockchainState[]).indexOf(state);
                return (
                  <div key={state} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-[#a855f7]/10 border border-[#a855f7]/20' : 'border border-transparent'}`}>
                    <div className={`w-3 h-3 rounded-full shrink-0 ${isActive ? 'bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.6)]' : isPast ? 'bg-[#5a5a68]' : 'bg-[#2a2a30] border border-[#3a3a40]'}`}></div>
                    <span className={`text-xs font-mono font-bold ${isActive ? 'text-[#a855f7]' : isPast ? 'text-[#5a5a68]' : 'text-[#3a3a40]'}`}>{state}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Right Column: Dynamic Action Pane ─── */}
        <div className="space-y-6 lg:col-span-2">

          {aiAnalysisPanel()}

          <div className="flex justify-start sm:justify-end">
            <div className="text-right">
              <button
                onClick={handleAnalyzeNow}
                disabled={isBusy || escrow.blockchainState !== 'FUNDED' || !escrow.hasSubmission}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/15 px-4 py-2 text-sm font-bold text-[#d9c5ff] transition-colors hover:bg-[#a855f7]/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Analyze Now
              </button>
              {(lastAnalysisAt || escrow.verifyTxId) && (
                <p className="mt-1 text-[0.7rem] text-[#8a8a98]">
                  Last analysis: {lastAnalysisAt ? new Date(lastAnalysisAt).toLocaleTimeString() : 'recently'}
                  {escrow.verifyTxId ? ` | Tx: ${escrow.verifyTxId}` : ''}
                </p>
              )}
              {(escrow.blockchainState !== 'FUNDED' || !escrow.hasSubmission) && (
                <p className="mt-1 text-[0.7rem] text-[#8a8a98]">
                  Available after escrow is FUNDED and deliverables are submitted.
                </p>
              )}
            </div>
          </div>

          {/* ══ CREATED: Awaiting Funding ══ */}
          {escrow.blockchainState === 'CREATED' && (
            <div className="rounded-2xl border border-yellow-500/20 bg-[#141418] p-5 shadow-xl sm:p-8">
              {viewMode === 'client' ? (
                <div>
                  <h2 className="text-2xl font-bold mb-2 font-['Outfit']">Fund This Escrow</h2>
                  <p className="text-[#8a8a98] text-sm mb-8">
                    Lock {escrow.amount.toLocaleString()} {escrow.currency} into the Algorand smart contract. Funds are held trustlessly until the freelancer's deliverables pass AI verification.
                  </p>
                  <div className="mb-6 rounded-xl border border-white/5 bg-[#0a0a0c] p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-[#8a8a98]">Escrow Amount</span>
                      <span className="text-white font-mono font-bold">{escrow.amount.toLocaleString()} {escrow.currency}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-[#8a8a98]">Platform Fee (0.5%)</span>
                      <span className="text-white font-mono">{(escrow.amount * 0.005).toFixed(2)} {escrow.currency}</span>
                    </div>
                    <div className="border-t border-white/5 my-3"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white">Total</span>
                      <span className="text-[#c084fc] font-mono font-bold text-lg">{(escrow.amount * 1.005).toFixed(2)} {escrow.currency}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleFundEscrow}
                    className="w-full bg-linear-to-r from-yellow-500 to-yellow-600 text-black font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    Fund Escrow — Lock {escrow.amount.toLocaleString()} {escrow.currency}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20 text-yellow-400 text-2xl">
                    ⏳
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-['Outfit']">Waiting for Client to Fund</h3>
                  <p className="text-[#8a8a98] max-w-sm mx-auto text-sm">
                    The escrow contract has been created. Once the client deposits {escrow.amount.toLocaleString()} {escrow.currency}, you'll be able to start working and submit your deliverables.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ FUNDED: In Progress / Submission / Verifying / Verified ══ */}
          {escrow.blockchainState === 'FUNDED' && (
            <>
              {/* Sub-state: IN_PROGRESS — waiting for freelancer */}
              {uiStatus === 'IN_PROGRESS' && (
                <div className="rounded-2xl border border-white/5 bg-[#141418] p-5 shadow-xl sm:p-8">
                  {viewMode === 'client' ? (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 bg-[#a855f7]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#a855f7]/20 text-[#a855f7] text-2xl">
                        ⏱
                      </div>
                      <h3 className="text-xl font-bold mb-2 font-['Outfit']">Awaiting Freelancer Submission</h3>
                      <p className="text-[#8a8a98] max-w-md mx-auto text-sm">
                        Your {escrow.amount.toLocaleString()} {escrow.currency} is securely locked in the Algorand smart contract. It cannot be accessed by the freelancer until their work passes AI verification.
                      </p>
                      <div className="mt-6">
                        <button onClick={handleClientDispute}
                          className="text-red-400 text-sm border border-red-500/20 px-6 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
                          Raise Dispute
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-bold mb-2 font-['Outfit']">Submit Deliverables</h2>
                      <p className="text-[#8a8a98] text-sm mb-8">
                        Complete the form below to trigger AI verification. The analysis is advisory and the client must explicitly confirm transfer.
                      </p>
                      <div className="space-y-5">
                        <div>
                          <label className="text-sm font-semibold text-white mb-2 block">GitHub Repository URL *</label>
                          <input type="text" placeholder="https://github.com/yourusername/repo"
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                            value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-white mb-2 block">Live Preview URL (Optional)</label>
                          <input type="text" placeholder="https://preview-link.vercel.app"
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                            value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-white mb-2 block">Notes for AI Agent</label>
                          <textarea rows={3} placeholder="How to run the project, where the main wallet logic is, etc."
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#a855f7]/50 transition-colors resize-none"
                            value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                        </div>
                        <button onClick={handleSubmitWork}
                          className="w-full bg-linear-to-r from-[#a855f7] to-[#7c3aed] text-white font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 transform hover:-translate-y-0.5 mt-2">
                          Submit Work &amp; Trigger AI Evaluation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-state: VERIFYING — AI is running */}
              {uiStatus === 'VERIFYING' && (
                <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-[#141418] p-6 text-center shadow-xl sm:p-10 lg:p-12">
                  <div className="absolute inset-0 bg-linear-to-br from-purple-500/5 to-transparent pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"></div>
                    <h2 className="text-2xl font-bold font-['Outfit'] text-white mb-3">AI Agent is Verifying…</h2>
                    <p className="text-[#8a8a98] max-w-md mx-auto mb-6 text-sm">
                      The verification engine is analyzing the submission against escrow requirements.
                    </p>
                    <div className="w-full max-w-sm mb-4">
                      <div className="bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
                        <div className="bg-purple-500 h-2 rounded-full w-2/3 animate-pulse"></div>
                      </div>
                      <span className="text-xs font-mono text-purple-400 mt-2 block">Executing vitest suite…</span>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-4 py-2 mt-2">
                      <span className="text-xs font-mono text-purple-300">Blockchain State: FUNDED — AI evaluation is off-chain</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-state: VERIFIED — AI approved, about to complete */}
              {uiStatus === 'VERIFIED' && (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#141418] p-5 shadow-xl sm:p-8">
                  <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                  <div className="relative z-10 text-center py-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 text-emerald-400 text-3xl">
                      ✓
                    </div>
                    <h2 className="text-2xl font-bold font-['Outfit'] mb-2">AI Approved — Score: {escrow.aiScore}/100</h2>
                    <p className="text-[#8a8a98] text-sm mb-4">Threshold met. Client must still confirm delivery to release funds.</p>
                    <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
                      <span className="text-xs font-mono text-emerald-300">Awaiting client transfer decision.</span>
                    </div>
                    {viewMode === 'client' && (
                      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          onClick={handleClientConfirm}
                          disabled={isBusy}
                          className="px-6 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold text-sm hover:bg-emerald-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Confirm Delivery
                        </button>
                        <button
                          onClick={handleClientDispute}
                          disabled={isBusy}
                          className="px-6 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 font-bold text-sm hover:bg-red-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Raise Dispute
                        </button>
                      </div>
                    )}
                    {viewMode === 'freelancer' && (
                      <div className="mt-6">
                        <button
                          onClick={handleAnalyzeNow}
                          disabled={isBusy}
                          className="inline-flex items-center justify-center rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 text-violet-200 font-bold px-5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Re-Analyze
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-state: SUBMITTED — waiting for AI to run */}
              {uiStatus === 'SUBMITTED' && (
                <div className="rounded-2xl border border-violet-500/20 bg-[#141418] p-5 py-8 text-center shadow-xl sm:p-8 sm:py-10">
                  <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-500/20 text-violet-400 text-2xl">
                    📦
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-['Outfit']">Work Submitted</h3>
                  <p className="text-[#8a8a98] max-w-md mx-auto text-sm">
                    The freelancer has submitted deliverables. Run Analyze Now to refresh recommendation after any updates.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={handleAnalyzeNow}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 text-violet-200 font-bold px-5 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Analyze Now
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'client' && escrow.aiScore !== null && uiStatus !== 'VERIFYING' && (
                <div className="bg-[#141418] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-2">Client Decision Required</h3>
                  <p className="text-sm text-[#8a8a98] mb-4">
                    AI analysis is complete. Choose whether to release funds to freelancer or open a dispute.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleClientConfirm}
                      disabled={isBusy}
                      className="flex-1 py-3 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold hover:bg-emerald-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Confirm Delivery and Release Funds
                    </button>
                    <button
                      onClick={handleClientDispute}
                      disabled={isBusy}
                      className="flex-1 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 font-bold hover:bg-red-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Raise Dispute
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'freelancer' && escrow.hasSubmission && uiStatus !== 'VERIFYING' && (
                <div className="bg-[#141418] border border-white/5 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold font-['Outfit'] mb-2">Update Submission</h3>
                  <p className="text-[#8a8a98] text-sm mb-5">
                    You can update deliverables and run analysis again before the client decides transfer or dispute.
                  </p>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Updated GitHub repository URL"
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Updated live preview URL"
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                      value={liveUrl}
                      onChange={(e) => setLiveUrl(e.target.value)}
                    />
                    <textarea
                      rows={3}
                      placeholder="What changed since last submission?"
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#a855f7]/50 transition-colors resize-none"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                    <button
                      onClick={handleSubmitWork}
                      disabled={isBusy}
                      className="w-full bg-linear-to-r from-[#a855f7] to-[#7c3aed] text-white font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Update Submission &amp; Re-Analyze
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ COMPLETED: Payment Released ══ */}
          {escrow.blockchainState === 'COMPLETED' && (
            <div className="relative overflow-hidden rounded-2xl border border-[#a855f7]/30 bg-[#141418] p-5 shadow-[0_0_30px_rgba(168,85,247,0.05)] sm:p-8">
              <div className="absolute top-0 right-0 bg-[#a855f7] text-white font-bold text-xs px-4 py-1 rounded-bl-xl tracking-widest uppercase">
                Smart Contract Executed
              </div>

              <h2 className="text-2xl font-bold mb-6 font-['Outfit'] border-b border-white/5 pb-4">AI Evaluation Scorecard</h2>

              <div className="flex flex-col md:flex-row gap-8 mb-8">
                {/* Score Circle */}
                <div className="w-36 h-36 shrink-0 bg-[#0a0a0c] rounded-full border-8 border-[#a855f7]/20 flex flex-col items-center justify-center shadow-inner mx-auto md:mx-0">
                  <span className="text-4xl font-black font-['Outfit'] text-[#a855f7]">{escrow.aiScore}</span>
                  <span className="text-xs text-[#8a8a98] uppercase tracking-wider">out of 100</span>
                </div>

                {/* Detailed Feedback */}
                {escrow.aiVerdict && (
                  <div className="flex-1 space-y-4">
                    {escrow.aiVerdict.matched.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-bold text-white mb-2">✓ Matched Requirements</h4>
                        <ul className="space-y-1">
                          {escrow.aiVerdict.matched.map((m, i) => (
                            <li key={i} className="text-xs text-[#8a8a98] flex items-start gap-2">
                              <span className="text-[#a855f7]">•</span> {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-sm font-bold text-white mb-2">No Matched Requirements</h4>
                        <p className="text-xs text-[#8a8a98]">The analysis did not find evidence for any requirement in the submitted inputs.</p>
                      </div>
                    )}
                    {escrow.aiVerdict.gaps.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-yellow-500 mb-2">⚠ Gaps Found</h4>
                        <ul className="space-y-1">
                          {escrow.aiVerdict.gaps.map((g, i) => (
                            <li key={i} className="text-xs text-[#8a8a98] flex items-start gap-2">
                              <span className="text-yellow-500">•</span> {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-xl p-5 mb-6 text-center">
                {typeof escrow.aiScore === 'number' && escrow.aiScore >= 75 ? (
                  <>
                    <h3 className="text-[#a855f7] font-bold mb-1">Threshold Met — Score ≥ 75/100</h3>
                    <p className="text-sm text-[#a855f7]/80">
                      AI evaluation passed the threshold, and the client-approved release moved funds to the freelancer.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-[#a855f7] font-bold mb-1">Released By Manual Decision</h3>
                    <p className="text-sm text-[#a855f7]/80">
                      Funds were released via a manual decision path, not by meeting the AI score threshold.
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-colors border border-white/5">
                  View Transaction on Explorer
                </button>
              </div>
            </div>
          )}

          {/* ══ DISPUTED ══ */}
          {escrow.blockchainState === 'DISPUTED' && (
            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-[#141418] p-5 shadow-xl sm:p-8">
              <div className="absolute top-0 right-0 bg-red-500 text-white font-bold text-xs px-4 py-1 rounded-bl-xl tracking-widest uppercase">
                Dispute Active
              </div>
              <h2 className="text-2xl font-bold mb-2 font-['Outfit']">Dispute Resolution</h2>
              <p className="text-[#8a8a98] text-sm mb-6">
                {escrow.aiScore !== null && escrow.aiScore < 75
                  ? `The AI verification scored ${escrow.aiScore}/100, which is below the 75-point threshold. The escrow is now in dispute mode pending arbitration.`
                  : 'The client has raised a dispute on this escrow. An arbiter will review the evidence and render a decision.'}
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-red-400 font-semibold">Locked Amount</span>
                  <span className="text-white font-mono font-bold">{escrow.amount.toLocaleString()} {escrow.currency}</span>
                </div>
                <p className="text-xs text-[#8a8a98] mt-2">Funds remain locked in the contract until an arbiter calls arbitrate() to resolve the dispute.</p>
              </div>
              {viewMode === 'client' && (
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-colors border border-white/5">
                    Submit Evidence
                  </button>
                  <button onClick={handleWithdrawDispute}
                    className="flex-1 bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#a855f7] font-bold py-3 rounded-lg transition-colors border border-[#a855f7]/20">
                    Withdraw Dispute
                  </button>
                  <button onClick={handleAskRefund}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-3 rounded-lg transition-colors border border-red-500/20">
                    Ask for Refund
                  </button>
                </div>
              )}
              {viewMode === 'freelancer' && (
                <button className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-colors border border-white/5">
                  Submit Counter-Evidence
                </button>
              )}
            </div>
          )}

          {/* ══ REFUNDED ══ */}
          {escrow.blockchainState === 'REFUNDED' && (
            <div className="rounded-2xl border border-orange-500/20 bg-[#141418] p-5 py-8 text-center shadow-xl sm:p-8 sm:py-10">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/20 text-orange-400 text-2xl">
                ↩
              </div>
              <h3 className="text-xl font-bold mb-2 font-['Outfit']">Escrow Refunded</h3>
              <p className="text-[#8a8a98] max-w-md mx-auto text-sm">
                {escrow.amount.toLocaleString()} {escrow.currency} has been returned to the client's wallet via the smart contract.
              </p>
            </div>
          )}

          {/* ══ EXPIRED ══ */}
          {escrow.blockchainState === 'EXPIRED' && (
            <div className="rounded-2xl border border-zinc-500/20 bg-[#141418] p-5 py-8 text-center shadow-xl sm:p-8 sm:py-10">
              <div className="w-16 h-16 bg-zinc-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-500/20 text-zinc-400 text-2xl">
                ⌛
              </div>
              <h3 className="text-xl font-bold mb-2 font-['Outfit']">Escrow Expired</h3>
              <p className="text-[#8a8a98] max-w-md mx-auto text-sm">
                The deadline has passed without completion. The client may request a refund.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Freelance;

