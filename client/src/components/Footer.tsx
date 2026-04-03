import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-[#a855f7]/20 bg-[linear-gradient(180deg,rgba(5,5,7,0.96)_0%,rgba(10,10,12,1)_100%)] px-6 pb-8 pt-14 font-['Inter']">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Link to="/" className="flex w-fit items-center gap-2 text-3xl font-extrabold tracking-tight text-white font-['Outfit']">
              <span className="text-[#a855f7] drop-shadow-[0_0_10px_rgba(168,85,247,0.45)]">▲</span>
              AlgoEscrow
            </Link>
            <p className="max-w-sm text-[0.95rem] leading-relaxed text-[#8a8a98]">
              Trust-minimized escrow infrastructure for modern commerce, workflow automation,
              and API-based automation on Algorand.
            </p>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#a855f7]/25 bg-[#a855f7]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#c084fc]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" />
              Powered by Algorand
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-white text-[1.1rem] font-semibold font-['Outfit']">Platform</h4>
            <ul className="flex flex-col gap-4">
              <li><Link to="/marketplace" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Marketplace</Link></li>
              <li><Link to="/merchant" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Merchant Dashboard</Link></li>
              <li><Link to="/workflows" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Workflows Workspace</Link></li>
              <li><Link to="/api" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">API Integration</Link></li>
            </ul>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-white text-[1.1rem] font-semibold font-['Outfit']">Resources</h4>
            <ul className="flex flex-col gap-4">
              <li><a href="https://developer.algorand.org/" target="_blank" rel="noreferrer" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Algorand Docs</a></li>
              <li><a href="https://github.com/algorandfoundation" target="_blank" rel="noreferrer" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">GitHub Examples</a></li>
              <li><a href="https://algorandtechnologies.com/ecosystem/use-cases" target="_blank" rel="noreferrer" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Use Cases</a></li>
              <li><Link to="/login" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Account Access</Link></li>
            </ul>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-white text-[1.1rem] font-semibold font-['Outfit']">Company</h4>
            <ul className="flex flex-col gap-4">
              <li><a href="#" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Privacy Policy</a></li>
              <li><a href="#" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Terms of Service</a></li>
              <li><a href="#" className="text-[#8a8a98] text-[0.95rem] transition-colors hover:text-[#a855f7]">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-7 text-center text-sm text-[#5a5a68]">
          <p>&copy; {new Date().getFullYear()} AlgoEscrow. Trustless settlements for the programmable economy.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
