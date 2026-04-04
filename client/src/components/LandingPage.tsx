import { Link } from 'react-router-dom';
import DarkVeil from './DarkVeil';

const LandingPage = () => {
  return (
    <div className="flex flex-col w-full">
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative flex min-h-screen w-full items-start overflow-hidden pt-24 sm:pt-28 lg:items-center lg:pt-0">

          {/* ================= BACKGROUND ================= */}
          <div className="absolute inset-0 z-0">

            {/* DarkVeil */}
            <div className="absolute inset-0 opacity-70">
              <DarkVeil
                hueShift={0}
                noiseIntensity={0}
                scanlineIntensity={0}
                speed={0.5}
                scanlineFrequency={0}
                warpAmount={0}
              />
            </div>

          </div>

          {/* ================= CONTENT ================= */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 sm:py-12 lg:py-24">
            <div className="flex w-full flex-col items-center gap-10 md:gap-12 lg:flex-row lg:gap-16">

              {/* LEFT */}
              <div className="flex-[1.2] text-center lg:text-left">

                {/* Tag */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-md sm:mb-8 sm:px-4">
                  <span className="w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-pulse"></span>
                  Escrow as a Service
                </div>

                {/* Heading */}
                <h1 className="mb-6 text-[3rem] font-black leading-[0.92] tracking-tight text-white drop-shadow-[0_0_40px_rgba(0,0,0,0.8)] sm:text-6xl lg:mb-8 lg:text-8xl">
                  Trustless.
                  <br />
                  <span className="text-white/40 font-light italic">Instant.</span>
                  <br />
                  <span className="bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#a855f7] bg-clip-text text-transparent">
                    Programmable.
                  </span>
                </h1>

                {/* Description */}
                <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-[#8a8a98] sm:text-lg md:text-xl lg:mx-0 lg:mb-10">
                  No need to trust the other party, Secure funds, verify work with AI, and release payments instantly.
                </p>

                {/* CTA */}
                <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center lg:justify-start lg:gap-4">

                  <Link
                    to="/workflows"
                    className="w-full rounded-xl bg-gradient-to-r from-[#a855f7] to-[#c084fc] px-6 py-3.5 text-center text-base font-bold text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all hover:scale-[1.02] sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
                  >
                    Start Workflows Escrow
                  </Link>

                  <Link
                    to="/marketplace"
                    className="w-full rounded-xl border border-white/10 px-6 py-3.5 text-center text-base text-white transition hover:bg-white/10 sm:w-auto sm:px-8 sm:py-4"
                  >
                    View Live Demo →
                  </Link>

                </div>
              </div>

              {/* RIGHT (CLEAN CARD - NO TILT) */}
              <div className="w-full max-w-md flex-1">

                <div className="rounded-2xl border border-white/10 bg-[#141418]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-6">

                  <div className="mb-6 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white sm:text-base">App ID: 104592</span>
                    <span className="rounded bg-[#a855f7]/20 px-2.5 py-1 text-[11px] text-[#a855f7] sm:px-3 sm:text-xs">
                      FUNDED
                    </span>
                  </div>

                  <div className="space-y-4 text-sm text-[#8a8a98]">
                    <div className="flex justify-between">
                      <span>Escrow Type</span>
                      <span className="text-white">Workflows</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="text-white font-mono">50,000 ALGO</span>
                    </div>

                    <div className="flex justify-between">
                      <span>AI Status</span>
                      <span className="text-[#c084fc]">Awaiting Submission</span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </div>
        </section>

        {/* COMPARISON SECTION */}
        <section className="py-24 lg:py-32 px-6 border-t border-white/5 bg-[#0a0a0c] relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-[#ff5f56]/05 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 font-['Outfit'] tracking-tight">The On-Chain Advantage</h2>
              <p className="text-[#8a8a98] text-lg lg:text-xl max-w-2xl mx-auto font-medium">Why the world's leading protocols are moving away from legacy custodians.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
              {/* Legacy Card */}
              <div className="group p-8 lg:p-10 rounded-[2rem] bg-white/[0.02] border border-white/10 backdrop-blur-md transition-all duration-300 hover:border-white/20">
                <div className="flex items-center justify-between mb-10 pb-6 border-b border-white/5">
                  <h3 className="text-2xl font-bold text-white/60 font-['Outfit']">Legacy Custodians</h3>
                  <span className="text-[10px] font-black text-[#ff5f56] uppercase tracking-[0.2em] px-3 py-1 bg-[#ff5f56]/10 rounded-full border border-[#ff5f56]/20">Standard</span>
                </div>
                <ul className="flex flex-col gap-6">
                  {[
                    "0.89% – 3.25% processing fee",
                    "3 to 7 days finality timeframe",
                    "Centralized custodian risk exposure",
                    "Manual, opaque dispute resolution"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-4 text-[#6a6a78] font-medium group-hover:text-[#8a8a98] transition-colors">
                      <div className="mt-1 w-5 h-5 rounded-full bg-[#ff5f56]/10 flex items-center justify-center flex-shrink-0 border border-[#ff5f56]/20">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#ff5f56]"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </div>
                      <span className="text-sm lg:text-base leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AlgoEscrow Card */}
              <div className="group relative p-8 lg:p-10 rounded-[2rem] bg-gradient-to-br from-[#a855f7]/10 to-[#7c3aed]/05 border border-[#a855f7]/30 backdrop-blur-2xl shadow-[0_20px_50px_rgba(168,85,247,0.1)] transition-all duration-300 hover:scale-[1.02] hover:border-[#a855f7]/50 overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#a855f7]/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-[#a855f7]/20 transition-all duration-700"></div>

                <div className="flex items-center justify-between mb-10 pb-6 border-b border-[#a855f7]/20 relative z-10">
                  <h3 className="text-2xl font-black text-white font-['Outfit']">AlgoEscrow</h3>
                  <span className="text-[10px] font-black text-[#a855f7] uppercase tracking-[0.2em] px-3 py-1 bg-[#a855f7]/20 rounded-full border border-[#a855f7]/30 animate-pulse">Efficient</span>
                </div>

                <ul className="flex flex-col gap-6 relative z-10 font-bold tracking-tight">
                  {[
                    "0.5% flat platform fee",
                    "2.8-second instant finality",
                    "Trustless smart contract vault",
                    "AI-automated scoring & arbitration"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-4 text-white group-hover:translate-x-1 transition-transform">
                      <div className="mt-1 w-5 h-5 rounded-full bg-[#a855f7]/20 flex items-center justify-center flex-shrink-0 border border-[#a855f7]/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                        <svg width="10" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-[#a855f7]"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <span className="text-sm lg:text-base leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>


        {/* THREE ESCROW MODES SECTION */}
        <section className="py-24 lg:py-32 px-6 bg-[#0a0a0c] border-t border-white/5 relative overflow-hidden">
          {/* Ambient Background Elements */}
          <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-[#7c3aed]/05 blur-[120px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 font-['Outfit'] tracking-tight">
                Three Distinct Escrow Modes
              </h2>
              <p className="text-lg lg:text-xl text-[#8a8a98] max-w-3xl mx-auto font-medium">
                Our factory contract adapts to any transaction scale. Deploy custom secure vaults via our REST API or the native SDK.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Mode 1: Marketplace */}
              <div className="group relative bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 lg:p-10 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.04] hover:border-[#a855f7]/30 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center text-white mb-10 shadow-[0_10px_30px_rgba(124,58,237,0.3)] group-hover:scale-110 transition-transform duration-500 relative z-10">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 font-['Outfit'] relative z-10">Marketplace Escrow</h3>
                <p className="text-[#8a8a98] mb-8 leading-relaxed font-medium relative z-10">
                  Institutional-grade B2B settlements. Automate fund release based on shipping oracles or inventory confirmation.
                </p>
                <Link to="/merchant" className="relative z-10 inline-flex items-center gap-2 text-[#c084fc] font-bold hover:gap-3 transition-all">
                  Explore Dashboard <span>→</span>
                </Link>
              </div>

              {/* Mode 2: P2P */}
              <div className="group relative bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 lg:p-10 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.04] hover:border-[#a855f7]/30 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9333ea] to-[#c084fc] flex items-center justify-center text-white mb-10 shadow-[0_10px_30px_rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform duration-500 relative z-10">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 font-['Outfit'] relative z-10">Direct P2P Escrow</h3>
                <p className="text-[#8a8a98] mb-8 leading-relaxed font-medium relative z-10">
                  Trustless deals for individuals. Secure your high-value trades with mutual digital signatures and instant finality.
                </p>
                <Link to="/marketplace" className="relative z-10 inline-flex items-center gap-2 text-[#c084fc] font-bold hover:gap-3 transition-all">
                  Start P2P Deal <span>→</span>
                </Link>
              </div>

              {/* Mode 3: Workflows AI */}
              <div className="group relative bg-white/[0.02] border border-[#a855f7]/20 rounded-[2.5rem] p-8 lg:p-10 transition-all duration-500 hover:-translate-y-2 hover:bg-[#a855f7]/05 hover:border-[#a855f7]/40 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                {/* AI Badge */}
                <div className="absolute top-8 right-8 z-20">
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] text-[9px] font-black uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(168,85,247,0.2)] animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-[#a855f7]"></span>
                    AI Verified
                  </span>
                </div>

                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#c084fc] flex items-center justify-center text-white mb-10 shadow-[0_10px_30px_rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform duration-500 relative z-10">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 font-['Outfit'] relative z-10">Workflows Workspace</h3>
                <p className="text-[#8a8a98] mb-8 leading-relaxed font-medium relative z-10">
                  The future of work. Claude AI autonomously verifies code deliverables against your spec to trigger instant payments.
                </p>
                <Link to="/workflows" className="relative z-10 inline-flex items-center gap-2 text-[#a855f7] font-bold hover:gap-3 transition-all">
                  Launch Workspace <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>


        {/* STATS SECTION / TRUST BAR */}
        <section className="py-24 lg:py-32 px-6 border-t border-white/5 bg-[#0a0a0c] relative">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-0 items-center">
              {/* Stat 1 */}
              <div className="flex flex-col items-center justify-center text-center px-8 lg:border-r lg:border-white/10">
                <div className="text-5xl lg:text-7xl font-black text-white mb-4 font-['Outfit'] tracking-tighter">0.5%</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#a855f7] animate-pulse"></div>
                  <p className="text-[#8a8a98] uppercase tracking-[0.3em] text-[10px] font-black">Flat Platform Fee</p>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="flex flex-col items-center justify-center text-center px-8 lg:border-r lg:border-white/10">
                <div className="text-5xl lg:text-7xl font-black text-[#c084fc] mb-4 font-['Outfit'] tracking-tighter">2.8s</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#c084fc] animate-pulse"></div>
                  <p className="text-[#8a8a98] uppercase tracking-[0.3em] text-[10px] font-black">Settlement Finality</p>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="flex flex-col items-center justify-center text-center px-8">
                <div className="text-5xl lg:text-7xl font-black text-white mb-4 font-['Outfit'] tracking-tighter">100%</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  <p className="text-[#8a8a98] uppercase tracking-[0.3em] text-[10px] font-black">On-Chain Audit</p>
                </div>
              </div>
            </div>

            {/* Trust Footer */}
            <div className="mt-24 pt-12 border-t border-white/5 flex flex-wrap justify-center items-center gap-8 lg:gap-16 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="text-white font-bold tracking-widest text-sm uppercase italic">Algorand Foundation</span>
              <span className="text-white font-bold tracking-widest text-sm uppercase italic">Pera Wallet</span>
              <span className="text-white font-bold tracking-widest text-sm uppercase italic">Voi Network</span>
              <span className="text-white font-bold tracking-widest text-sm uppercase italic">Defly</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
