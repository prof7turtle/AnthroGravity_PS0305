import { useState } from 'react';

type ViewMode = 'client' | 'freelancer';
type EscrowState = 'funded' | 'verifying' | 'completed' | 'disputed';

const Freelance = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('client');
  const [escrowState, setEscrowState] = useState<EscrowState>('funded');

  // Form State for Freelancer submission
  const [repoUrl, setRepoUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [aiScore, setAiScore] = useState<number | null>(null);

  // Mock submission handler
  const handleSubmitWork = () => {
    setEscrowState('verifying');
    // Simulate AI checking process taking 3 seconds
    setTimeout(() => {
      setAiScore(88); // mock successful score
      setEscrowState('completed');
    }, 3000);
  };

  const getStatusBadge = () => {
    switch (escrowState) {
      case 'funded':
        return <span className="bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Funds Locked Active</span>;
      case 'verifying':
        return <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">AI Agent Verifying</span>;
      case 'completed':
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Payment Released</span>;
      case 'disputed':
        return <span className="bg-red-500/20 text-red-500 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Disputed</span>;
    }
  };

  return (
    <div className="pt-8 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen text-white font-['Inter']">
      
      {/* Top Demo Toolbar */}
      <div className="bg-[#141418] border border-[#00ff88]/30 rounded-xl p-4 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
        <div>
          <h3 className="text-[#00ff88] font-bold text-sm tracking-widest uppercase mb-1">Interactive Demo Mode</h3>
          <p className="text-xs text-[#8a8a98]">Toggle between parties to see exactly how AlgoEscrow handles state for each user.</p>
        </div>
        <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
          <button 
            onClick={() => setViewMode('client')} 
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'client' ? 'bg-white text-black' : 'text-[#8a8a98] hover:text-white'}`}
          >
            View as Client
          </button>
          <button 
            onClick={() => setViewMode('freelancer')} 
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'freelancer' ? 'bg-white text-black' : 'text-[#8a8a98] hover:text-white'}`}
          >
            View as Freelancer
          </button>
        </div>
      </div>

      {/* Gig Header */}
      <div className="bg-[#141418] border border-white/5 rounded-2xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00ff88]/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[#8a8a98] font-mono text-sm">ESCROW ID: #AE-8842-X</span>
              {getStatusBadge()}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 font-['Outfit']">React Native Wallet Integration</h1>
            <p className="text-[#8a8a98]">Client: 0x4F...8a9C • Freelancer: 0x9B...1f4D</p>
          </div>
          <div className="text-left md:text-right bg-black/40 border border-white/5 p-4 rounded-xl">
            <div className="text-[#8a8a98] text-sm font-semibold mb-1 uppercase tracking-wider">Locked Payment</div>
            <div className="text-3xl font-mono font-bold text-white flex items-center gap-2">
              <span className="text-[#00d4ff]">2,500</span> USDC
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Requirements */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-[#141418] border border-white/5 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold border-b border-white/5 pb-4 mb-4 font-['Outfit']">Gig Requirements</h2>
            <div className="space-y-4">
              <p className="text-sm text-[#8a8a98] leading-relaxed">
                Build a React Native component that connects to the Algorand blockchain using Pera Wallet.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-sm text-[#d4d4d8]">
                  <span className="text-[#00ff88] mt-0.5">✓</span> Must use AlgoKit Utils TypeScript SDK.
                </li>
                <li className="flex items-start gap-2 text-sm text-[#d4d4d8]">
                  <span className="text-[#00ff88] mt-0.5">✓</span> Must successfully sign and send a 0-ALGO transaction.
                </li>
                <li className="flex items-start gap-2 text-sm text-[#d4d4d8]">
                  <span className="text-[#00ff88] mt-0.5">✓</span> Code must have 100% test coverage using vitest.
                </li>
              </ul>
              
              <div className="mt-6 pt-6 border-t border-white/5">
                <h4 className="text-xs font-bold text-[#8a8a98] uppercase tracking-widest mb-3">AI Verification Criteria</h4>
                <div className="bg-black/30 p-4 rounded-lg border border-white/5 text-xs text-[#8a8a98] font-mono leading-relaxed">
                  "Claude API will clone the submitted GitHub repo, check for the presence of algokit-utils in package.json, run 'npm test', and statically analyze the code for a wallet connection method."
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Action Pane */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* STATE: FUNDED (WAITING FOR SUBMISSION) */}
          {escrowState === 'funded' && (
            <div className="bg-[#141418] border border-white/5 rounded-2xl p-8 shadow-xl">
              {viewMode === 'client' ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-[#00ff88]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00ff88]/20 text-[#00ff88] text-2xl">
                    ⏱
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-['Outfit']">Awaiting Freelancer Submission</h3>
                  <p className="text-[#8a8a98] max-w-sm mx-auto">
                    Your 2,500 USDC is securely locked in the Algorand smart contract. 
                    It cannot be accessed by the freelancer until the AI verifies their work.
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold mb-2 font-['Outfit']">Submit Work for Verification</h2>
                  <p className="text-[#8a8a98] text-sm mb-8">
                    Complete the form below to trigger the AI Agent evaluation. If your code passes, payment is instantly released to your wallet via smart contract.
                  </p>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-semibold text-white mb-2 block">GitHub Repository URL</label>
                      <input 
                        type="text" 
                        placeholder="https://github.com/yourusername/repo"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88]/50 transition-colors"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-white mb-2 block">Live Preview URL (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="https://preview-link.vercel.app"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88]/50 transition-colors"
                        value={liveUrl}
                        onChange={(e) => setLiveUrl(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-white mb-2 block">Release Notes for AI</label>
                      <textarea 
                        rows={4}
                        placeholder="Explain how to run the project, where the main wallet logic is located, etc."
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88]/50 transition-colors resize-none"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      ></textarea>
                    </div>
                    
                    <button 
                      onClick={handleSubmitWork}
                      className="w-full bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-black font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] transition-all duration-300 transform hover:-translate-y-0.5 mt-4"
                    >
                      Submit & Trigger AI Evaluation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE: VERIFYING (AI IN PROGRESS) */}
          {escrowState === 'verifying' && (
            <div className="bg-[#141418] border border-purple-500/30 rounded-2xl p-12 shadow-xl text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"></div>
                <h2 className="text-2xl font-bold font-['Outfit'] text-white mb-3">Claude AI is verifying the submission...</h2>
                <p className="text-[#8a8a98] max-w-md mx-auto mb-6">
                  The AI Agent is cloning the repository, running tests, and grading the code against the escrow requirements.
                </p>
                
                <div className="w-full max-w-sm bg-black/50 rounded-full h-2 mb-2 overflow-hidden border border-white/5">
                  <div className="bg-purple-500 h-2 rounded-full w-2/3 animate-pulse"></div>
                </div>
                <span className="text-xs font-mono text-purple-400">Executing vitest suite...</span>
              </div>
            </div>
          )}

          {/* STATE: COMPLETED (AI APPROVED SCORECARD) */}
          {escrowState === 'completed' && (
            <div className="bg-[#141418] border border-[#00ff88]/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,255,136,0.05)] relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-[#00ff88] text-black font-bold text-xs px-4 py-1 rounded-bl-xl tracking-widest uppercase">
                 Smart Contract Executed
               </div>
               
               <h2 className="text-2xl font-bold mb-6 font-['Outfit'] border-b border-white/5 pb-4">AI Evaluation Scorecard</h2>
               
               <div className="flex flex-col md:flex-row gap-8 mb-8">
                 {/* Score Circle */}
                 <div className="w-40 h-40 shrink-0 bg-[#0a0a0c] rounded-full border-8 border-[#00ff88]/20 flex flex-col items-center justify-center shadow-inner relative">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="50%" cy="50%" r="48%" stroke="#00ff88" strokeWidth="8" fill="none" strokeDasharray="300" strokeDashoffset={300 - (300 * (aiScore || 0)) / 100} className="transition-all duration-1000 ease-out" />
                    </svg>
                    <span className="text-4xl font-black font-['Outfit'] text-[#00ff88] relative z-10">{aiScore}</span>
                    <span className="text-xs text-[#8a8a98] uppercase tracking-wider relative z-10">out of 100</span>
                 </div>
                 
                 {/* Detailed Feedback */}
                 <div className="flex-1">
                   <div className="mb-4">
                     <span className="text-sm font-bold text-white mb-2 block">✓ Architecture & SDK Usage (30/30)</span>
                     <p className="text-xs text-[#8a8a98]">AlgoKit Utils TS effectively integrated. Pera Wallet sessions managed correctly.</p>
                   </div>
                   <div className="mb-4">
                     <span className="text-sm font-bold text-white mb-2 block">✓ Functionality (40/40)</span>
                     <p className="text-xs text-[#8a8a98]">Successfully parsed and built the 0-ALGO payment transaction. Signature execution verified.</p>
                   </div>
                   <div>
                     <span className="text-sm font-bold text-yellow-500 mb-2 block">⚠ Testing (18/30)</span>
                     <p className="text-xs text-[#8a8a98]">Vitest covers 85% of lines instead of requested 100%. Minor missing coverage on edge case disconnects.</p>
                   </div>
                 </div>
               </div>
               
               <div className="bg-[#00ff88]/10 border border-[#00ff88]/20 rounded-xl p-5 mb-6 text-center">
                 <h3 className="text-[#00ff88] font-bold mb-1">Threshold Met (Minimum 80/100)</h3>
                 <p className="text-sm text-[#00ff88]/80">The smart contract has automatically released 2,500 USDC to the freelancer.</p>
               </div>
               
               <div className="flex gap-4 space-y-0">
                  <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-colors border border-white/5">
                    View Transaction on Explorer
                  </button>
                  {viewMode === 'client' && (
                    <button className="flex-1 bg-[#0a0a0c] hover:bg-red-500/10 text-[#8a8a98] hover:text-red-400 font-bold py-3 rounded-lg transition-colors border border-white/5 hover:border-red-500/30">
                      Dispute Evaluation
                    </button>
                  )}
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Freelance;
