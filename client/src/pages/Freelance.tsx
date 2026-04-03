import { useState } from 'react';

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
  aiVerdict: { matched: string[]; gaps: string[]; score: number } | null;
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
};

// ─── Component ───────────────────────────────────────────────────────────
const Freelance = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('client');
  const [escrow, setEscrow] = useState<EscrowData>(INITIAL_ESCROW);

  // Freelancer form
  const [repoUrl, setRepoUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [notes, setNotes] = useState('');

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
  const handleFundEscrow = () => {
    setEscrow((prev) => ({ ...prev, blockchainState: 'FUNDED' }));
  };

  const handleSubmitWork = () => {
    setEscrow((prev) => ({ ...prev, hasSubmission: true, isAiRunning: true }));
    // Simulate AI agent verification (3 seconds)
    setTimeout(() => {
      const score = 88;
      const verdict = {
        score,
        matched: ['AlgoKit Utils TS integrated', '0-ALGO transaction signed', 'Pera Wallet session managed'],
        gaps: ['Test coverage at 85% instead of 100%'],
      };
      setEscrow((prev) => ({ ...prev, isAiRunning: false, aiScore: score, aiVerdict: verdict }));
      // AI approved → move to COMPLETED
      if (score >= 75) {
        setTimeout(() => {
          setEscrow((prev) => ({ ...prev, blockchainState: 'COMPLETED' }));
        }, 1500);
      } else {
        setTimeout(() => {
          setEscrow((prev) => ({ ...prev, blockchainState: 'DISPUTED' }));
        }, 1500);
      }
    }, 3000);
  };

  const handleClientConfirm = () => {
    setEscrow((prev) => ({ ...prev, blockchainState: 'COMPLETED' }));
  };

  const handleClientDispute = () => {
    setEscrow((prev) => ({ ...prev, blockchainState: 'DISPUTED' }));
  };

  const handleResetDemo = () => {
    setEscrow(INITIAL_ESCROW);
    setRepoUrl('');
    setLiveUrl('');
    setNotes('');
  };

  // ─── Badge Renderers ─────────────────────────────────────────────────
  const blockchainBadge = () => {
    const colors: Record<BlockchainState, string> = {
      CREATED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      FUNDED: 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/30',
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
      IN_PROGRESS: { text: 'In Progress', cls: 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20' },
      SUBMITTED: { text: 'Work Submitted', cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
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
        default: return [];
      }
    } else {
      switch (escrow.blockchainState) {
        case 'FUNDED':
          if (!escrow.hasSubmission) return ['submit work'];
          return ['view status'];
        default: return ['view status'];
      }
    }
  };

  const allowedActions = getAllowedActions();

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="pt-8 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen text-white font-['Inter']">

      {/* ═══ Demo Toolbar ═══ */}
      <div className="bg-[#141418] border border-[#00ff88]/30 rounded-xl p-4 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
        <div>
          <h3 className="text-[#00ff88] font-bold text-sm tracking-widest uppercase mb-1">Interactive Demo Mode</h3>
          <p className="text-xs text-[#8a8a98]">Toggle between Client &amp; Freelancer to see role-based permissions and the escrow state machine in action.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setViewMode('client')}
              className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'client' ? 'bg-white text-black' : 'text-[#8a8a98] hover:text-white'}`}
            >
              Client (User)
            </button>
            <button
              onClick={() => setViewMode('freelancer')}
              className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'freelancer' ? 'bg-white text-black' : 'text-[#8a8a98] hover:text-white'}`}
            >
              Freelancer (Merchant)
            </button>
          </div>
          <button onClick={handleResetDemo}
            className="text-xs text-[#8a8a98] hover:text-white border border-white/10 px-3 py-2 rounded-lg transition-colors"
          >
            Reset Demo
          </button>
        </div>
      </div>

      {/* ═══ Gig Header ═══ */}
      <div className="bg-[#141418] border border-white/5 rounded-2xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00ff88]/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative z-10">
          <div className="flex-1">
            {/* Dual Badge Row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[#8a8a98] font-mono text-xs">ESCROW #{escrow.id}</span>
              {blockchainBadge()}
              {uiStatusBadge()}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 font-['Outfit']">{escrow.title}</h1>
            <p className="text-[#8a8a98] text-sm">
              Client: <span className="text-white font-mono">{escrow.clientAddr}</span> &nbsp;•&nbsp;
              Freelancer: <span className="text-white font-mono">{escrow.freelancerAddr}</span>
            </p>
          </div>

          {/* Locked Payment */}
          <div className="text-left lg:text-right bg-black/40 border border-white/5 p-5 rounded-xl min-w-[200px]">
            <div className="text-[#8a8a98] text-xs font-semibold mb-1 uppercase tracking-widest">
              {escrow.blockchainState === 'COMPLETED' ? 'Released Amount' : escrow.blockchainState === 'CREATED' ? 'Escrow Amount' : 'Locked Payment'}
            </div>
            <div className="text-3xl font-mono font-bold text-white">
              <span className="text-[#00d4ff]">{escrow.amount.toLocaleString()}</span> {escrow.currency}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

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
                  <span className="text-[#00ff88] mt-0.5 shrink-0">✓</span> {req}
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
                  <div key={state} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-[#00ff88]/10 border border-[#00ff88]/20' : 'border border-transparent'}`}>
                    <div className={`w-3 h-3 rounded-full shrink-0 ${isActive ? 'bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.6)]' : isPast ? 'bg-[#5a5a68]' : 'bg-[#2a2a30] border border-[#3a3a40]'}`}></div>
                    <span className={`text-xs font-mono font-bold ${isActive ? 'text-[#00ff88]' : isPast ? 'text-[#5a5a68]' : 'text-[#3a3a40]'}`}>{state}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Right Column: Dynamic Action Pane ─── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ══ CREATED: Awaiting Funding ══ */}
          {escrow.blockchainState === 'CREATED' && (
            <div className="bg-[#141418] border border-yellow-500/20 rounded-2xl p-8 shadow-xl">
              {viewMode === 'client' ? (
                <div>
                  <h2 className="text-2xl font-bold mb-2 font-['Outfit']">Fund This Escrow</h2>
                  <p className="text-[#8a8a98] text-sm mb-8">
                    Lock {escrow.amount.toLocaleString()} {escrow.currency} into the Algorand smart contract. Funds are held trustlessly until the freelancer's deliverables pass AI verification.
                  </p>
                  <div className="bg-[#0a0a0c] border border-white/5 rounded-xl p-6 mb-6">
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
                      <span className="text-[#00d4ff] font-mono font-bold text-lg">{(escrow.amount * 1.005).toFixed(2)} {escrow.currency}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleFundEscrow}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all duration-300 transform hover:-translate-y-0.5"
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
                <div className="bg-[#141418] border border-white/5 rounded-2xl p-8 shadow-xl">
                  {viewMode === 'client' ? (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 bg-[#00ff88]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00ff88]/20 text-[#00ff88] text-2xl">
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
                        Complete the form below to trigger AI verification. If your code scores ≥ 75/100, payment is automatically released via the smart contract.
                      </p>
                      <div className="space-y-5">
                        <div>
                          <label className="text-sm font-semibold text-white mb-2 block">GitHub Repository URL *</label>
                          <input type="text" placeholder="https://github.com/yourusername/repo"
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88]/50 transition-colors"
                            value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-white mb-2 block">Live Preview URL (Optional)</label>
                          <input type="text" placeholder="https://preview-link.vercel.app"
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88]/50 transition-colors"
                            value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-white mb-2 block">Notes for AI Agent</label>
                          <textarea rows={3} placeholder="How to run the project, where the main wallet logic is, etc."
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88]/50 transition-colors resize-none"
                            value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
                        </div>
                        <button onClick={handleSubmitWork}
                          className="w-full bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-black font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] transition-all duration-300 transform hover:-translate-y-0.5 mt-2">
                          Submit Work &amp; Trigger AI Evaluation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-state: VERIFYING — AI is running */}
              {uiStatus === 'VERIFYING' && (
                <div className="bg-[#141418] border border-purple-500/30 rounded-2xl p-12 shadow-xl text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"></div>
                    <h2 className="text-2xl font-bold font-['Outfit'] text-white mb-3">AI Agent is Verifying…</h2>
                    <p className="text-[#8a8a98] max-w-md mx-auto mb-6 text-sm">
                      The Claude AI agent is cloning the repository, running tests, and scoring the code against the escrow requirements.
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
                <div className="bg-[#141418] border border-emerald-500/30 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                  <div className="relative z-10 text-center py-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 text-emerald-400 text-3xl">
                      ✓
                    </div>
                    <h2 className="text-2xl font-bold font-['Outfit'] mb-2">AI Approved — Score: {escrow.aiScore}/100</h2>
                    <p className="text-[#8a8a98] text-sm mb-4">Threshold met. Smart contract is executing payment release…</p>
                    <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
                      <span className="text-xs font-mono text-emerald-300 animate-pulse">Calling confirmDelivery() on-chain…</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-state: SUBMITTED — waiting for AI to run */}
              {uiStatus === 'SUBMITTED' && (
                <div className="bg-[#141418] border border-cyan-500/20 rounded-2xl p-8 shadow-xl text-center py-10">
                  <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/20 text-cyan-400 text-2xl">
                    📦
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-['Outfit']">Work Submitted</h3>
                  <p className="text-[#8a8a98] max-w-md mx-auto text-sm">
                    The freelancer has submitted deliverables. AI verification will begin shortly.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ══ COMPLETED: Payment Released ══ */}
          {escrow.blockchainState === 'COMPLETED' && (
            <div className="bg-[#141418] border border-[#00ff88]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,136,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#00ff88] text-black font-bold text-xs px-4 py-1 rounded-bl-xl tracking-widest uppercase">
                Smart Contract Executed
              </div>

              <h2 className="text-2xl font-bold mb-6 font-['Outfit'] border-b border-white/5 pb-4">AI Evaluation Scorecard</h2>

              <div className="flex flex-col md:flex-row gap-8 mb-8">
                {/* Score Circle */}
                <div className="w-36 h-36 shrink-0 bg-[#0a0a0c] rounded-full border-8 border-[#00ff88]/20 flex flex-col items-center justify-center shadow-inner mx-auto md:mx-0">
                  <span className="text-4xl font-black font-['Outfit'] text-[#00ff88]">{escrow.aiScore}</span>
                  <span className="text-xs text-[#8a8a98] uppercase tracking-wider">out of 100</span>
                </div>

                {/* Detailed Feedback */}
                {escrow.aiVerdict && (
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-2">✓ Matched Requirements</h4>
                      <ul className="space-y-1">
                        {escrow.aiVerdict.matched.map((m, i) => (
                          <li key={i} className="text-xs text-[#8a8a98] flex items-start gap-2">
                            <span className="text-[#00ff88]">•</span> {m}
                          </li>
                        ))}
                      </ul>
                    </div>
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

              <div className="bg-[#00ff88]/10 border border-[#00ff88]/20 rounded-xl p-5 mb-6 text-center">
                <h3 className="text-[#00ff88] font-bold mb-1">Threshold Met — Score ≥ 75/100</h3>
                <p className="text-sm text-[#00ff88]/80">
                  The smart contract has automatically released {escrow.amount.toLocaleString()} {escrow.currency} to the freelancer.
                </p>
              </div>

              <div className="flex gap-4">
                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-colors border border-white/5">
                  View Transaction on Explorer
                </button>
                {viewMode === 'client' && (
                  <button onClick={handleClientDispute}
                    className="flex-1 bg-[#0a0a0c] hover:bg-red-500/10 text-[#8a8a98] hover:text-red-400 font-bold py-3 rounded-lg transition-colors border border-white/5 hover:border-red-500/30">
                    Dispute Evaluation
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ══ DISPUTED ══ */}
          {escrow.blockchainState === 'DISPUTED' && (
            <div className="bg-[#141418] border border-red-500/30 rounded-2xl p-8 shadow-xl relative overflow-hidden">
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
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-400 font-semibold">Locked Amount</span>
                  <span className="text-white font-mono font-bold">{escrow.amount.toLocaleString()} {escrow.currency}</span>
                </div>
                <p className="text-xs text-[#8a8a98] mt-2">Funds remain locked in the contract until an arbiter calls arbitrate() to resolve the dispute.</p>
              </div>
              {viewMode === 'client' && (
                <div className="flex gap-4">
                  <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-colors border border-white/5">
                    Submit Evidence
                  </button>
                  <button onClick={handleClientConfirm}
                    className="flex-1 bg-[#00ff88]/10 hover:bg-[#00ff88]/20 text-[#00ff88] font-bold py-3 rounded-lg transition-colors border border-[#00ff88]/20">
                    Withdraw Dispute &amp; Release Funds
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
            <div className="bg-[#141418] border border-orange-500/20 rounded-2xl p-8 shadow-xl text-center py-10">
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
            <div className="bg-[#141418] border border-zinc-500/20 rounded-2xl p-8 shadow-xl text-center py-10">
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
