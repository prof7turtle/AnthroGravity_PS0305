import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '@txnlab/use-wallet-react';
import axios from 'axios';


const DEMO_SELLER_ADDRESS = 'O46OHE3KQGD6YVJUGXI7MRI33ZSOT3ODXGKKPOQWM5RVZCEKVJFHVGWDL4';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DUMMY_PRODUCTS = [
  {
    id: 1,
    name: 'SaaS Platform Source Code',
    category: 'Software',
    price: 50000,
    seller: 'TechPro Solutions',
    description: 'Complete codebase for an enterprise SaaS platform. Includes React frontend, Node.js backend, and infrastructure scripts.',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 2,
    name: 'Premium Domain: Web3Data.com',
    category: 'Domain',
    price: 15000,
    seller: 'DomainVault',
    description: 'High-value premium domain name perfect for a blockchain analytics startup.',
    image: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 3,
    name: 'Bespoke Mobile Application',
    category: 'Transfer',
    price: 32000,
    seller: 'MobileFirst Agency',
    description: 'Fully built iOS and Android fitness application with 10k Active Users.',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=400'
  }
];

const Marketplace = () => {
  const { isAuthenticated } = useAuth();
  const { activeAddress } = useWallet();
  const navigate = useNavigate();

  const [tradeType, setTradeType] = useState('buying');
  const [assetType, setAssetType] = useState('software');
  const [price, setPrice] = useState('10000');
  const [currency, setCurrency] = useState('ALGO');

  const handleBuy = async (item?: { name: string }) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!activeAddress) {
      alert('Please connect your wallet first.');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/api/escrow/create`, {
        seller: DEMO_SELLER_ADDRESS,
        itemName: item?.name || `Custom ${assetType} transaction`,
        escrowType: 0,
        deadlineRounds: 500,
      });

      const appId = response?.data?.data?.appId;
      if (!appId) {
        throw new Error('Escrow app id not returned from backend');
      }
      navigate(`/escrow/${appId}`);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error || error.message
        : error instanceof Error
          ? error.message
          : 'Failed to create escrow';
      alert(message);
    }
  };

  return (
    <div className="w-full bg-[#0a0a0c] min-h-screen text-white font-['Inter']">

      {/* ESCROW.COM STYLE HERO WIDGET */}
      <section className="bg-[#141418] border-b border-white/5 pt-8 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 font-['Outfit']">
            With AlgoEscrow you can buy and sell anything safely without the risk of chargebacks.
          </h1>
          <p className="text-[#8a8a98] text-lg mb-10">Truly secure programmable payments.</p>

          <div className="bg-[#1c1c22] border border-white/10 rounded-xl p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-4 items-center">

              <div className="flex w-full md:w-2/5 rounded bg-black/50 border border-white/10 overflow-hidden">
                <select
                  className="bg-transparent text-white px-4 py-3 outline-none border-r border-white/10 flex-1 appearance-none cursor-pointer"
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value)}
                >
                  <option className="bg-[#0f0f14] text-white" value="buying">I'm Buying</option>
                  <option className="bg-[#0f0f14] text-white" value="selling">I'm Selling</option>
                  <option className="bg-[#0f0f14] text-white" value="brokering">I'm Brokering</option>
                </select>
                <select
                  className="bg-transparent text-white px-4 py-3 outline-none flex-1 appearance-none cursor-pointer"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                >
                  <option className="bg-[#0f0f14] text-white" value="software">Software / Code...</option>
                  <option className="bg-[#0f0f14] text-white" value="domain">Domain Names...</option>
                  <option className="bg-[#0f0f14] text-white" value="services">Services...</option>
                  <option className="bg-[#0f0f14] text-white" value="goods">Physical Goods...</option>
                </select>
              </div>

              <div className="flex w-full md:w-2/5 rounded bg-black/50 border border-white/10 overflow-hidden">
                <div className="flex items-center px-4 text-[#8a8a98]">for</div>
                <input
                  type="number"
                  className="bg-transparent text-white py-3 outline-none flex-1 font-mono w-24"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <select
                  className="bg-transparent text-white px-4 py-3 outline-none border-l border-white/10 appearance-none cursor-pointer"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option className="bg-[#0f0f14] text-white" value="ALGO">ALGO</option>
                  <option className="bg-[#0f0f14] text-white" value="USDC">USDC</option>
                  <option className="bg-[#0f0f14] text-white" value="USD">USD</option>
                </select>
              </div>

              <button
                onClick={() => handleBuy({ name: `Custom ${assetType} transaction` })}
                className="w-full md:w-1/5 bg-[#a855f7] text-white font-bold py-3 px-6 rounded hover:bg-[#7c3aed] transition-colors"
              >
                Get started now
              </button>

            </div>
          </div>
        </div>
      </section>

      {/* DUMMY PRODUCTS GRID */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-3xl font-bold font-['Outfit']">Sample Assets</h2>
          <p className="text-[#8a8a98]">Select an item below to initiate an AlgoEscrow transaction.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {DUMMY_PRODUCTS.map((pkg) => (
            <div key={pkg.id} className="bg-[#141418] border border-white/5 rounded-xl overflow-hidden hover:-translate-y-1 transition-transform shadow-lg group">
              <div className="h-48 overflow-hidden relative">
                <img src={pkg.image} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur border border-white/10 text-xs font-bold px-2 py-1 rounded text-white tracking-widest uppercase">
                  {pkg.category}
                </div>
              </div>
              <div className="p-6">
                <div className="text-xs text-[#a855f7] font-bold mb-2">Seller: {pkg.seller}</div>
                <h3 className="text-xl font-bold mb-3">{pkg.name}</h3>
                <p className="text-[#8a8a98] text-sm mb-6 line-clamp-2">{pkg.description}</p>
                <div className="flex justify-between items-center border-t border-white/5 pt-4">
                  <div className="font-mono text-xl font-bold text-white">
                    {pkg.price.toLocaleString()} ALGO
                  </div>
                  <button
                    onClick={() => handleBuy({ name: pkg.name })}
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-2 px-6 rounded transition-colors"
                  >
                    Buy Securely
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default Marketplace;

