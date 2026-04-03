import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Merchant Dashboard', path: '/merchant' },
    { name: 'Freelance', path: '/freelance' },
    { name: 'API Integration', path: '/api' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isScrolled 
          ? 'py-4 bg-[#0a0a0c]/85 backdrop-blur-md border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.4)]' 
          : 'py-6 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold text-white tracking-tight cursor-pointer font-['Outfit']">
          <span className="text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]">▲</span>
          AlgoEscrow
        </Link>
        <ul className="hidden md:flex gap-8 list-none m-0 p-0">
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
                  className={`absolute left-0 -bottom-1 h-0.5 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded transition-all duration-300 ${
                    location.pathname === link.path ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                ></span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center">
          {isAuthenticated ? (
            <button 
              onClick={handleLogout}
              className="bg-transparent border border-white/20 text-white py-2.5 px-6 rounded-lg font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/30"
            >
              Sign Out
            </button>
          ) : (
            <button className="bg-gradient-to-br from-[#00ff88] to-[#00d4ff] text-[#0a0a0c] border-none py-2.5 px-6 rounded-lg font-semibold text-[0.95rem] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,255,136,0.4)]">
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
