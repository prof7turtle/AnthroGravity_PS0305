import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const navLinks = [
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Merchant Dashboard', path: '/merchant' },
    { name: 'Freelance', path: '/freelance' },
    { name: 'API Integration', path: '/api' },
  ];

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
      navigate('/');
      return;
    }

    navigate('/login');
  };

  return (
    <nav className="fixed left-0 top-0 z-50 w-full  py-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold text-white tracking-tight cursor-pointer font-['Outfit']">
          <span className="text-[#a855f7] drop-shadow-[0_0_10px_rgba(168,85,247,0.45)]">▲</span>
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
                  className={`absolute left-0 -bottom-1 h-0.5 bg-linear-to-r from-[#a855f7] to-[#c084fc] rounded transition-all duration-300 ${
                    location.pathname === link.path ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                ></span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center">
          <button
            onClick={handleAuthAction}
            className={`rounded-lg py-2.5 px-6 text-[0.95rem] font-semibold transition-all duration-200 ${
              isAuthenticated
                ? 'border border-white/20 bg-transparent text-white hover:border-white/35 hover:bg-white/10'
                : 'border border-[#a855f7]/30 bg-linear-to-br from-[#a855f7] to-[#7c3aed] text-white hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(168,85,247,0.35)]'
            }`}
          >
            {isAuthenticated ? 'Sign Out' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
