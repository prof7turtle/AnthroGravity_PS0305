import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Merchant = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'transactions' | 'disputes' | 'api'>('transactions');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="w-full bg-[#0a0a0c] min-h-screen text-white font-['Inter']">
      
      {/* Merchant Header */}
      <div className="bg-[#141418] border-b border-white/5 pt-8 pb-8 px-6 relative overflow-hidden">
        {/* subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00ff88]/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold font-['Outfit'] mb-2">Merchant Dashboard</h1>
            <p className="text-[#8a8a98] text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
              Logged in successfully as <strong className="text-white">{user?.email}</strong>
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="border border-red-500/30 text-red-400 hover:bg-red-500/10 px-5 py-2.5 rounded-lg text-sm transition-all duration-200 font-semibold"
          >
            Log Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`text-left px-5 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-3 ${activeTab === 'transactions' ? 'bg-gradient-to-r from-[#00ff88]/10 to-transparent text-[#00ff88] border border-[#00ff88]/20' : 'text-[#8a8a98] hover:bg-white/5 border border-transparent'}`}
          >
            
            Transaction Track
          </button>
          <button 
            onClick={() => setActiveTab('disputes')}
            className={`text-left px-5 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-between ${activeTab === 'disputes' ? 'bg-gradient-to-r from-[#00d4ff]/10 to-transparent text-[#00d4ff] border border-[#00d4ff]/20' : 'text-[#8a8a98] hover:bg-white/5 border border-transparent'}`}
          >
            <div className="flex items-center gap-3">
              
              Disputes
            </div>
            <span className="bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-white text-[0.65rem] px-2 py-0.5 rounded-full font-bold">1</span>
          </button>
          <button 
            onClick={() => setActiveTab('api')}
            className={`text-left px-5 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-3 ${activeTab === 'api' ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-purple-400 border border-purple-500/20' : 'text-[#8a8a98] hover:bg-white/5 border border-transparent'}`}
          >
            
            API Setup
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[600px]">
          
          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#141418] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#00ff88]/10 flex items-center justify-center text-[#00ff88]">
                    
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-['Outfit']">24</div>
                    <div className="text-xs text-[#8a8a98] uppercase tracking-wider font-semibold">Active Escrows</div>
                  </div>
                </div>
                <div className="bg-[#141418] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff]">
                    
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-['Outfit']">142K</div>
                    <div className="text-xs text-[#8a8a98] uppercase tracking-wider font-semibold">Total Volume (ALGO)</div>
                  </div>
                </div>
                <div className="bg-[#141418] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-['Outfit']">3.2</div>
                    <div className="text-xs text-[#8a8a98] uppercase tracking-wider font-semibold">Avg Days in Escrow</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#141418] border border-white/5 rounded-xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                  <h2 className="text-lg font-bold font-['Outfit'] text-white">Recent Transactions</h2>
                  <button className="text-xs text-[#00ff88] hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/40 text-[#8a8a98] text-xs uppercase tracking-wider">
                        <th className="font-semibold p-4 border-b border-white/5">Escrow ID</th>
                        <th className="font-semibold p-4 border-b border-white/5">Item</th>
                        <th className="font-semibold p-4 border-b border-white/5">Amount</th>
                        <th className="font-semibold p-4 border-b border-white/5">Buyer</th>
                        <th className="font-semibold p-4 border-b border-white/5">Status</th>
                        <th className="font-semibold p-4 border-b border-white/5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="p-4 font-mono text-xs text-[#a0a0ab]">APP-39210</td>
                        <td className="p-4 font-medium text-white">SaaS Codebase</td>
                        <td className="p-4 font-mono text-white">50,000</td>
                        <td className="p-4"><span className="bg-white/5 px-2 py-1 rounded-md text-[#8a8a98] text-xs">buy_x7..9a</span></td>
                        <td className="p-4">
                          <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs px-2.5 py-1 rounded-full font-semibold tracking-wide">FUNDED</span>
                        </td>
                        <td className="p-4">
                          <button className="text-[#0a0a0c] bg-[#00ff88] hover:bg-[#00cc6a] px-4 py-1.5 rounded text-xs font-bold transition-colors">Deliver App</button>
                        </td>
                      </tr>
                      <tr className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="p-4 font-mono text-xs text-[#a0a0ab]">APP-38411</td>
                        <td className="p-4 font-medium text-white">Web3Data.com</td>
                        <td className="p-4 font-mono text-white">15,000</td>
                        <td className="p-4"><span className="bg-white/5 px-2 py-1 rounded-md text-[#8a8a98] text-xs">buy_z2..4o</span></td>
                        <td className="p-4">
                          <span className="bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-xs px-2.5 py-1 rounded-full font-semibold tracking-wide">COMPLETED</span>
                        </td>
                        <td className="p-4">
                          <button className="text-[#8a8a98] hover:text-white border border-white/10 hover:bg-white/10 px-4 py-1.5 rounded text-xs font-bold transition-colors">Details</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DISPUTES */}
          {activeTab === 'disputes' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#141418] border border-white/5 p-8 rounded-xl shadow-xl">
                <h2 className="text-2xl font-bold mb-2 font-['Outfit'] flex items-center gap-2">
                   Dispute Resolution
                </h2>
                <p className="text-[#8a8a98] text-sm mb-8">Manage disputed escrows and submit evidence for arbitration.</p>
                
                <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-red-500 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded tracking-wider uppercase shadow-[0_0_10px_rgba(239,68,68,0.5)]">Disputed</span>
                        <span className="text-[#8a8a98] font-mono text-xs bg-black/30 px-2 py-0.5 rounded">APP-37912</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">Bespoke Mobile App</h3>
                    </div>
                    <div className="text-left md:text-right bg-black/30 p-3 rounded-lg border border-white/5">
                      <div className="text-white font-mono font-bold text-lg">32,000 ALGO</div>
                      <div className="text-red-400 text-xs font-semibold mt-1 flex items-center gap-1"> Awaiting Evidence</div>
                    </div>
                  </div>
                  
                  <div className="bg-[#0a0a0c] border border-white/5 p-5 rounded-lg mb-6 shadow-inner">
                    <p className="text-sm text-[#8a8a98] mb-3 leading-relaxed">
                      <strong className="text-white block mb-1">Buyer Claim Transcript:</strong> 
                      "The application crashes immediately upon opening on iOS 17 devices. I cannot release funds until this compatibility issue is fundamentally resolved per our agreement."
                    </p>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                      <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                         Time remaining to respond: 48 hours
                      </span>
                    </div>
                  </div>

                  <button className="bg-white text-black font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition-colors shadow-lg hover:shadow-white/20 w-full sm:w-auto">
                    Submit Arbitration Evidence
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: API SETUP */}
          {activeTab === 'api' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#141418] border border-white/5 p-8 rounded-xl shadow-xl max-w-3xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                    
                  </div>
                  <h2 className="text-2xl font-bold font-['Outfit']">Developer Setup</h2>
                </div>
                <p className="text-[#8a8a98] text-sm mb-10 pl-14">Configure your automated marketplace routing via the REST SDK.</p>
                
                <div className="space-y-8">
                  <div className="bg-[#0a0a0c] border border-transparent hover:border-white/5 p-5 rounded-xl transition-colors">
                    <label className="text-sm font-semibold text-white mb-3 block">Your Merchant API Key</label>
                    <div className="flex bg-[#141418] border border-white/10 rounded-lg p-1.5 focus-within:border-purple-500/50 transition-colors">
                      <input type="text" readOnly value="sk_test_51Nx...8v3K2" className="bg-transparent text-[#00ff88] font-mono text-sm px-4 py-2 outline-none flex-1" />
                      <button className="bg-white/5 hover:bg-white/10 text-white font-semibold px-5 py-2 rounded-md text-sm transition-colors">
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-red-400/80 mt-2 font-medium">Keep this key secret. Never expose it in client-side code.</p>
                  </div>

                  <div className="bg-[#0a0a0c] border border-transparent hover:border-white/5 p-5 rounded-xl transition-colors">
                    <label className="text-sm font-semibold text-white mb-3 block">Webhook Signing Secret</label>
                    <div className="flex bg-[#141418] border border-white/10 rounded-lg p-1.5 focus-within:border-purple-500/50 transition-colors">
                      <input type="text" readOnly value="whsec_92fj3...o92kl" className="bg-transparent text-purple-400 font-mono text-sm px-4 py-2 outline-none flex-1" />
                      <button className="bg-white/5 hover:bg-white/10 text-white font-semibold px-5 py-2 rounded-md text-sm transition-colors">
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-[#8a8a98] mt-2">Used to verify that webhook payloads are originating from AlgoEscrow.</p>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <label className="text-sm font-semibold text-white mb-3 block">Delivery Oracle Webhook URL</label>
                    <div className="flex gap-3">
                      <input type="text" placeholder="https://api.yourmarketplace.com/algoescrow/webhook" className="flex-1 bg-[#0a0a0c] border border-white/10 rounded-lg text-white text-sm px-5 py-3.5 outline-none focus:border-purple-500/50 transition-colors font-mono" />
                      <button className="bg-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-600 transition-colors shadow-lg hover:shadow-purple-500/25 whitespace-nowrap">
                        Save Webhook
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Merchant;
