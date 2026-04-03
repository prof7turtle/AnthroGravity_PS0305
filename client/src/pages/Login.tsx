import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'merchant'>('user');
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const url = isLogin ? 'http://localhost:5000/api/auth/login' : 'http://localhost:5000/api/auth/register';
      const payload = isLogin ? { email, password } : { email, password, role };
      
      const res = await axios.post(url, payload);
      
      login(res.data.token, res.data.user);
      
      if (res.data.user.role === 'merchant') {
        navigate('/merchant');
      } else {
        navigate('/marketplace');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed');
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-80px)] px-6">
      <div className="w-full max-w-md bg-[#141418] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white mb-2 font-['Outfit']">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-[#8a8a98] text-sm">
            {isLogin ? 'Sign in to access your dashboard' : 'Join AlgoEscrow to start transacting securely'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium text-[#8a8a98] mb-1.5 block">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg text-white py-3 px-4 focus:outline-none focus:border-[#a855f7]/50"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#8a8a98] mb-1.5 block">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg text-white py-3 px-4 focus:outline-none focus:border-[#a855f7]/50"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="text-sm font-medium text-[#8a8a98] mb-1.5 block">Select Role</label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center justify-center py-3 border rounded-lg cursor-pointer transition-all ${role === 'user' ? 'border-[#a855f7] bg-[#a855f7]/10 text-[#a855f7]' : 'border-white/10 text-white hover:bg-white/5'}`}>
                  <input type="radio" value="user" checked={role === 'user'} onChange={(e) => setRole(e.target.value as any)} className="hidden" />
                  Buyer (User)
                </label>
                <label className={`flex-1 flex items-center justify-center py-3 border rounded-lg cursor-pointer transition-all ${role === 'merchant' ? 'border-[#c084fc] bg-[#c084fc]/10 text-[#c084fc]' : 'border-white/10 text-white hover:bg-white/5'}`}>
                  <input type="radio" value="merchant" checked={role === 'merchant'} onChange={(e) => setRole(e.target.value as any)} className="hidden" />
                  Seller (Merchant)
                </label>
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-linear-to-br from-[#a855f7] to-[#c084fc] text-white border-none py-3.5 rounded-lg font-bold text-lg cursor-pointer mt-4 hover:shadow-[0_4px_20px_rgba(168,85,247,0.2)] transition-shadow">
            {isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[#8a8a98] text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button onClick={() => setIsLogin(!isLogin)} className="text-[#a855f7] hover:underline font-semibold bg-transparent border-none cursor-pointer">
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

