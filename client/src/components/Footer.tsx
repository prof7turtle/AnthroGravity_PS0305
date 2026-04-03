import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#050507] border-t border-white/5 pt-24 pb-8 px-6 mt-16 font-['Inter']">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-2 text-3xl font-extrabold text-white tracking-tight cursor-pointer font-['Outfit']">
              <span className="text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]">▲</span>
              AlgoEscrow
            </div>
            <p className="text-[#8a8a98] leading-relaxed text-[0.95rem] max-w-sm">
              The premier Web3 platform for managing freelance contracts, software
              development milestones, and decentralized payments securely on Algorand.
            </p>
          </div>
          
          <div className="flex flex-col gap-6">
            <h4 className="text-white text-[1.1rem] font-semibold font-['Outfit']">Platform</h4>
            <ul className="flex flex-col gap-4">
              <li><Link to="/dashboard" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">My Dashboard</Link></li>
              <li><Link to="/create" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">New Escrow</Link></li>
              <li><Link to="/marketplace" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Marketplace Demo</Link></li>
              <li><Link to="/freelance" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Freelance Gigs</Link></li>
            </ul>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-white text-[1.1rem] font-semibold font-['Outfit']">Resources</h4>
            <ul className="flex flex-col gap-4">
              <li><a href="#docs" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Documentation</a></li>
              <li><a href="#tutorials" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Tutorials</a></li>
              <li><a href="#blog" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Blog</a></li>
              <li><a href="#support" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Support Center</a></li>
            </ul>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-white text-[1.1rem] font-semibold font-['Outfit']">Legal</h4>
            <ul className="flex flex-col gap-4">
              <li><a href="#privacy" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Privacy Policy</a></li>
              <li><a href="#terms" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Terms of Service</a></li>
              <li><a href="#security" className="text-[#8a8a98] text-[0.95rem] hover:text-[#00ff88] transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/5 text-center text-[#5a5a68] text-sm">
          <p>&copy; {new Date().getFullYear()} AlgoEscrow. Empowering decentralized work.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
