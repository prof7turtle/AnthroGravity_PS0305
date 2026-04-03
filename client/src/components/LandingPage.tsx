import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="flex flex-col w-full">      
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative min-h-screen flex items-center justify-between pt-32 pb-16 px-6 max-w-7xl mx-auto overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-[20%] left-1/2 w-[60vw] h-[60vw] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(0,255,136,0.08)_0%,rgba(0,212,255,0.05)_40%,rgba(10,10,12,0)_70%)] pointer-events-none -z-10"></div>
          
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-8 w-full z-10">
            {/* Content Left */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-block px-4 py-1.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-full text-sm font-semibold tracking-wide uppercase mb-8">
                Escrow as a Service
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6 text-white tracking-tight font-['Outfit']">
                Trustless, Instant, <br />
                <span className="bg-gradient-to-br from-[#00ff88] to-[#00d4ff] bg-clip-text text-transparent">Programmable Escrow</span>
              </h1>
              <p className="text-xl md:text-2xl text-[#8a8a98] leading-relaxed mb-12 max-w-xl mx-auto lg:mx-0">
                AlgoEscrow rebuilds traditional escrow infrastructure entirely on Algorand. Lock funds securely, verify deliveries with AI, and experience 2.8-second finality.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6">
                <Link to="/api" className="bg-gradient-to-br from-[#00ff88] to-[#00d4ff] text-[#0a0a0c] border-none py-4 px-10 rounded-xl font-bold text-lg cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,255,136,0.3)] text-center w-full sm:w-auto">
                  Integrate API
                </Link>
                <Link to="/marketplace" className="bg-white/5 text-white border border-white/10 py-4 px-10 rounded-xl font-bold text-lg cursor-pointer transition-all duration-200 hover:bg-white/10 text-center w-full sm:w-auto">
                  View Demo Integration
                </Link>
              </div>
            </div>
            
            {/* Visual Right Component */}
            <div className="flex-1 relative perspective-[1000px] w-full max-w-lg mx-auto">
              <div className="bg-[#141418]/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transform -rotate-y-[10deg] rotate-x-[5deg] transition-transform duration-500 hover:rotate-0 p-8 w-full ml-auto">
                <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                  <div className="font-semibold text-white font-['Outfit']">App ID: 104592</div>
                  <div className="px-3 py-1 rounded bg-[#00ff88]/20 text-[#00ff88] text-xs font-bold font-mono border border-[#00ff88]/30">STATE: FUNDED</div>
                </div>
                <div className="flex flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[#8a8a98] text-sm">Escrow Type</span>
                    <span className="text-white text-sm">2 (FREELANCE)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8a8a98] text-sm">Amount Locked</span>
                    <span className="text-white text-sm font-mono tracking-wider">50,000 ALGO</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8a8a98] text-sm">AI Verification</span>
                    <span className="text-[#00d4ff] text-sm">Awaiting Github URL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON SECTION */}
        <section className="py-24 px-6 border-t border-white/5 bg-[#08080a]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-white mb-4 font-['Outfit']">The On-Chain Advantage</h2>
              <p className="text-[#8a8a98] text-xl">How AlgoEscrow outperforms traditional centralized custodians.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="p-8 rounded-2xl bg-white/5 border border-white/5">
                <h3 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4">Escrow.com</h3>
                <ul className="flex flex-col gap-4 text-[#8a8a98]">
                  <li className="flex items-center gap-3"><span className="text-[#ff5f56]">✕</span> 0.89% – 3.25% processing fee</li>
                  <li className="flex items-center gap-3"><span className="text-[#ff5f56]">✕</span> 3 to 7 days finality</li>
                  <li className="flex items-center gap-3"><span className="text-[#ff5f56]">✕</span> Centralized custodian risk</li>
                  <li className="flex items-center gap-3"><span className="text-[#ff5f56]">✕</span> Manual dispute resolution</li>
                </ul>
              </div>
              <div className="p-8 rounded-2xl bg-[#00ff88]/5 border border-[#00ff88]/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88]/10 blur-3xl rounded-full"></div>
                <h3 className="text-2xl font-bold text-[#00ff88] mb-6 border-b border-[#00ff88]/20 pb-4 font-['Outfit']">AlgoEscrow</h3>
                <ul className="flex flex-col gap-4 text-white">
                  <li className="flex items-center gap-3"><span className="text-[#00ff88]">✓</span> 0.5% flat platform fee</li>
                  <li className="flex items-center gap-3"><span className="text-[#00ff88]">✓</span> 2.8-second instant finality</li>
                  <li className="flex items-center gap-3"><span className="text-[#00ff88]">✓</span> Trustless smart contract vault</li>
                  <li className="flex items-center gap-3"><span className="text-[#00ff88]">✓</span> AI-automated scoring & arbitration</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* THREE ESCROW MODES SECTION */}
        <section className="py-24 px-6 bg-[#0c0c0f] border-t border-white/5 relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 font-['Outfit']">
                Three Distinct Escrow Modes
              </h2>
              <p className="text-xl text-[#8a8a98] max-w-3xl mx-auto">
                No matter the transaction type, our factory contract handles it. Deploy custom escrows using our REST API or the AlgoEscrow SDK.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Mode 1 */}
              <div className="bg-[#141418] border border-white/10 rounded-2xl p-8 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xl mb-8 shadow-lg">1</div>
                <h3 className="text-2xl font-bold text-white mb-4 font-['Outfit']">Marketplace Escrow</h3>
                <p className="text-[#8a8a98] mb-6 leading-relaxed">
                  Perfect for B2B e-commerce platforms. Buyer pays, funds are locked on-chain, and an oracle automatically confirms delivery to release funds to the seller.
                </p>
                <Link to="/merchant" className="text-cyan-400 font-semibold flex items-center gap-2 hover:gap-3 transition-all">Explore Dashboard →</Link>
              </div>

              {/* Mode 2 */}
              <div className="bg-[#141418] border border-white/10 rounded-2xl p-8 hover:-translate-y-2 transition-transform duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl mb-8 shadow-lg">2</div>
                <h3 className="text-2xl font-bold text-white mb-4 font-['Outfit']">Direct P2P Escrow</h3>
                <p className="text-[#8a8a98] mb-6 leading-relaxed">
                  Zero intermediaries. Two individuals agree on a deal, the buyer funds the vault, and funds are released only upon mutual trustless confirmation.
                </p>
                <Link to="/marketplace" className="text-pink-400 font-semibold flex items-center gap-2 hover:gap-3 transition-all">Start P2P Deal →</Link>
              </div>

              {/* Mode 3 */}
              <div className="bg-[#141418] border border-white/10 rounded-2xl p-8 hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88]/5 blur-2xl rounded-full"></div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#00d4ff] flex items-center justify-center text-[#0a0a0c] font-bold text-xl mb-8 shadow-[0_0_20px_rgba(0,255,136,0.3)]">3</div>
                <h3 className="text-2xl font-bold text-white mb-4 font-['Outfit'] flex items-center gap-2">
                  Freelance Escrow <span className="bg-[#00ff88]/20 text-[#00ff88] text-[0.65rem] px-2 py-0.5 rounded uppercase tracking-wider border border-[#00ff88]/30">AI Verified</span>
                </h3>
                <p className="text-[#8a8a98] mb-6 leading-relaxed">
                  Post requirements. Freelancers submit GitHub links. Claude AI analyzes code deliverables against requirements, auto-releasing if score ≥ 75, or escalating if &lt; 75.
                </p>
                <Link to="/freelance" className="text-[#00ff88] font-semibold flex items-center gap-2 hover:gap-3 transition-all">Enter Workspace →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="py-24 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-around items-center gap-12 text-center">
            <div>
              <h4 className="text-5xl font-extrabold text-white mb-2 font-['Outfit']">0.5%</h4>
              <p className="text-[#8a8a98] uppercase tracking-wider text-sm font-semibold">Flat Platform Fee</p>
            </div>
            <div className="w-px h-16 bg-white/10 hidden md:block"></div>
            <div>
              <h4 className="text-5xl font-extrabold text-[#00d4ff] mb-2 font-['Outfit']">2.8s</h4>
              <p className="text-[#8a8a98] uppercase tracking-wider text-sm font-semibold">Transaction Finality</p>
            </div>
            <div className="w-px h-16 bg-white/10 hidden md:block"></div>
            <div>
              <h4 className="text-5xl font-extrabold text-[#00ff88] mb-2 font-['Outfit']">100%</h4>
              <p className="text-[#8a8a98] uppercase tracking-wider text-sm font-semibold">On-Chain Transparency</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
