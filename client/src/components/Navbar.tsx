import { useEffect, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WalletConnectButton from './WalletConnectButton';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeWallet } = useWallet();
  const { isAuthenticated, logout } = useAuth();

  const navLinks = [
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Merchant Dashboard', path: '/merchant' },
    { name: 'Workflows', path: '/workflows' },
    { name: 'API Integration', path: '/api' },
  ];

  const handleLoginRedirect = () => {
    navigate('/login');
  };

  const handleLogout = async () => {
    try {
      if (activeWallet?.isConnected) {
        await activeWallet.disconnect();
      }
      localStorage.removeItem('algoescrow_activeAddress');
    } catch {
      // Keep sign out flow resilient even if wallet disconnect fails.
    } finally {
      logout();
      navigate('/');
    }
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="fixed left-0 top-0 z-50 w-full py-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-white tracking-tight cursor-pointer font-['Outfit'] sm:text-2xl">
          <span className="text-[#a855f7] drop-shadow-[0_0_10px_rgba(168,85,247,0.45)]">▲</span>
          AlgoEscrow
        </Link>

        <ul className="hidden list-none m-0 gap-8 p-0 md:flex">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`relative text-[0.95rem] font-medium transition-colors duration-200 group ${
                  location.pathname === link.path ? 'text-white' : 'text-[#a0a0ab] hover:text-white'
                }`}
              >
                {link.name}
                <span
                  className={`absolute left-0 -bottom-1 h-0.5 duration-300 ${
                    location.pathname === link.path ? 'w-full' : 'w-0'
                  }`}
                ></span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <WalletConnectButton
                className="rounded-lg border border-[#a855f7]/30 bg-linear-to-br from-[#a855f7] to-[#7c3aed] px-4 py-2.5 text-[0.9rem] font-semibold text-white transition-all duration-200 hover:shadow-[0_8px_30px_rgba(168,85,247,0.35)]"
              />
              <button
                onClick={handleLogout}
                className="rounded-lg border border-white/20 bg-transparent py-2.5 px-4 text-[0.9rem] font-semibold text-white transition-all duration-200 hover:border-white/35 hover:bg-white/10"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={handleLoginRedirect}
              className="rounded-lg border border-[#a855f7]/30 bg-linear-to-br from-[#a855f7] to-[#7c3aed] py-2.5 px-6 text-[0.95rem] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(168,85,247,0.35)]"
            >
              Login
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 p-2 text-white transition-colors hover:bg-white/10 md:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            {isMobileMenuOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <>
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-white/10 bg-[#0a0a0c]/95 px-4 pb-4 pt-3 backdrop-blur-md md:hidden">
          <ul className="mb-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-[#a855f7]/15 text-white border border-[#a855f7]/30'
                      : 'text-[#a0a0ab] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>

          {isAuthenticated ? (
            <div className="flex flex-col gap-2">
              <WalletConnectButton
                className="w-full rounded-lg border border-[#a855f7]/30 bg-linear-to-br from-[#a855f7] to-[#7c3aed] py-2.5 px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_8px_30px_rgba(168,85,247,0.35)]"
              />
              <button
                onClick={handleLogout}
                className="w-full rounded-lg border border-white/20 bg-transparent py-2.5 px-4 text-sm font-semibold text-white transition-all duration-200 hover:border-white/35 hover:bg-white/10"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleLoginRedirect}
              className="w-full rounded-lg border border-[#a855f7]/30 bg-linear-to-br from-[#a855f7] to-[#7c3aed] py-2.5 px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_8px_30px_rgba(168,85,247,0.35)]"
            >
              Login
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
