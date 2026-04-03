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
      <div className="bg-[#141418] border-b border-white/5 pt-32 pb-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold font-['Outfit'] mb-2">Merchant Dashboard</h1>
            <p className="text-[#8a8a98] text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00ff88]"></span>
              Logged in as {user?.email}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded text-sm transition-colors font-semibold"
          >
            Log Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex items-start gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-64 shrink-0 hidden md:flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`text-left px-5 py-3 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'transactions' ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20' : 'text-[#8a8a98] hover:bg-white/5'}`}
          >
            Transaction Track
          </button>
          <button 
            onClick={() => setActiveTab('disputes')}
            className={`text-left px-5 py-3 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'disputes' ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-[#8a8a98] hover:bg-white/5'}`}
          >
            Dispute Resolution
            <span className="ml-2 bg-red-500 text-white text-[0.65rem] px-2 py-0.5 rounded-full">1 Action Reqd</span>
          </button>
          <button 
            onClick={() => setActiveTab('api')}
            className={`text-left px-5 py-3 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'api' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-[#8a8a98] hover:bg-white/5'}`}
          >
            API Setup
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#141418] border border-white/5 rounded-xl p-8 min-h-[500px]">
          
          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 font-['Outfit']">Active Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[#8a8a98] text-sm">
                      <th className="font-semibold p-4">Escrow ID</th>
                      <th className="font-semibold p-4">Item</th>
                      <th className="font-semibold p-4">Amount</th>
                      <th className="font-semibold p-4">Buyer</th>
                      <th className="font-semibold p-4">Status</th>
                      <th className="font-semibold p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono text-xs">APP-39210</td>
                      <td className="p-4">SaaS Codebase</td>
                      <td className="p-4 font-mono">50,000</td>
                      <td className="p-4 text-[#8a8a98]">buy_x7..9a</td>
                      <td className="p-4">
                        <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded">FUNDED</span>
                      </td>
                      <td className="p-4">
                        <button className="text-[#00ff88] hover:underline font-semibold">Deliver App</button>
                      </td>
                    </tr>
                    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono text-xs">APP-38411</td>
                      <td className="p-4">Web3Data.com</td>
                      <td className="p-4 font-mono">15,000</td>
                      <td className="p-4 text-[#8a8a98]">buy_z2..4o</td>
                      <td className="p-4">
                        <span className="bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-xs px-2 py-1 rounded">COMPLETED</span>
                      </td>
                      <td className="p-4">
                        <button className="text-[#8a8a98] hover:text-white font-semibold flex items-center gap-1">Details</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DISPUTES */}
          {activeTab === 'disputes' && (
            <div>
              <h2 className="text-2xl font-bold mb-2 font-['Outfit']">Dispute Resolution</h2>
              <p className="text-[#8a8a98] text-sm mb-6">Manage disputed escrows and submit evidence for arbitration.</p>
              
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-red-500 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded tracking-wider uppercase">Disputed</span>
                      <span className="text-[#8a8a98] font-mono text-xs">APP-37912</span>
                    </div>
                    <h3 className="text-lg font-bold">Bespoke Mobile App</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono font-bold">32,000 ALGO</div>
                    <div className="text-red-400 text-xs">Awaiting Seller Evidence</div>
                  </div>
                </div>
                
                <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-lg mb-6">
                  <p className="text-sm text-[#8a8a98] mb-2"><strong className="text-white">Buyer Claim:</strong> "The app crashes immediately upon opening on iOS 17 devices. I cannot release funds until this is fixed."</p>
                  <p className="text-xs text-red-400">Time remaining to respond: 48 hours</p>
                </div>

                <button className="bg-white text-black font-bold py-2.5 px-6 rounded hover:bg-gray-200 transition-colors">
                  Submit Evidence
                </button>
              </div>
            </div>
          )}

          {/* TAB: API SETUP */}
          {activeTab === 'api' && (
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold mb-2 font-['Outfit']">API Integration</h2>
              <p className="text-[#8a8a98] text-sm mb-8">Set up your marketplace automation via the AlgoEscrow REST API.</p>
              
              <div className="mb-8">
                <label className="text-sm font-semibold text-white mb-2 block">Your Merchant API Key</label>
                <div className="flex bg-[#0a0a0c] border border-white/10 rounded-lg p-1">
                  <input type="text" readOnly value="sk_test_51Nx...8v3K2" className="bg-transparent text-[#00ff88] font-mono text-sm px-3 py-2 outline-none flex-1" />
                  <button className="bg-[#141418] hover:bg-[#1a1a24] border border-white/10 text-white font-semibold px-4 py-2 rounded text-sm transition-colors">
                    Copy
                  </button>
                </div>
                <p className="text-xs text-[#8a8a98] mt-2">Keep this key secret. Never expose it in frontend code.</p>
              </div>

              <div className="mb-8">
                <label className="text-sm font-semibold text-white mb-2 block">Webhook Secret</label>
                <div className="flex bg-[#0a0a0c] border border-white/10 rounded-lg p-1">
                  <input type="text" readOnly value="whsec_92fj3...o92kl" className="bg-transparent text-purple-400 font-mono text-sm px-3 py-2 outline-none flex-1" />
                  <button className="bg-[#141418] hover:bg-[#1a1a24] border border-white/10 text-white font-semibold px-4 py-2 rounded text-sm transition-colors">
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-white mb-2 block">Delivery Oracle Webhook URL</label>
                <input type="text" placeholder="https://api.yourmarketplace.com/algoescrow/webhook" className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg text-white text-sm px-4 py-3 outline-none focus:border-[#00ff88]/50 transition-colors" />
                <button className="mt-4 bg-[#00ff88] text-black font-bold py-2.5 px-6 rounded hover:bg-[#00cc6a] transition-colors">
                  Save Webhook
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Merchant;
