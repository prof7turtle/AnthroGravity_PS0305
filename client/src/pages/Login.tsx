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
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const switchMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      const url = isLogin ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
      const payload = isLogin ? { email, password } : { email, password, role };

      const res = await axios.post(url, payload);

      login(res.data.token, res.data.user);

      if (res.data.user.role === 'merchant') {
        navigate('/merchant');
      } else {
        navigate('/marketplace');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Authentication failed. Please try again.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[calc(100vh-96px)] items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.15)_0%,rgba(10,10,12,0)_40%),radial-gradient(circle_at_80%_90%,rgba(124,58,237,0.12)_0%,rgba(10,10,12,0)_42%)]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#141418]/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-[#0f0f14] p-1">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                isLogin ? 'bg-[#a855f7] text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]' : 'text-[#8a8a98] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode(false)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                !isLogin ? 'bg-[#a855f7] text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]' : 'text-[#8a8a98] hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="mb-2 font-['Outfit'] text-3xl font-extrabold text-white">
            {isLogin ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p className="text-sm text-[#8a8a98]">
            {isLogin ? 'Sign in to continue to your escrow workspace.' : 'Set up your account to start secure, trustless transactions.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#8a8a98]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0a0a0c] px-4 py-3 text-white transition-colors placeholder:text-[#616171] focus:border-[#a855f7]/60 focus:outline-none"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#8a8a98]">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0a0a0c] px-4 py-3 pr-24 text-white transition-colors placeholder:text-[#616171] focus:border-[#a855f7]/60 focus:outline-none"
                placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[#b3b3c0] transition-colors hover:text-white"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#8a8a98]">Choose Account Type</label>
              <div className="flex gap-4">
                <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-3 transition-all ${role === 'user' ? 'border-[#a855f7] bg-[#a855f7]/10 text-[#c084fc]' : 'border-white/10 text-white hover:bg-white/5'}`}>
                  <input type="radio" value="user" checked={role === 'user'} onChange={(e) => setRole(e.target.value as 'user')} className="hidden" />
                  Buyer
                </label>
                <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-3 transition-all ${role === 'merchant' ? 'border-[#a855f7] bg-[#a855f7]/10 text-[#c084fc]' : 'border-white/10 text-white hover:bg-white/5'}`}>
                  <input type="radio" value="merchant" checked={role === 'merchant'} onChange={(e) => setRole(e.target.value as 'merchant')} className="hidden" />
                  Merchant
                </label>
              </div>
              <p className="mt-2 text-xs text-[#6f6f7d]">You can change role-specific behavior later from your account settings.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-lg border-none bg-linear-to-br from-[#a855f7] to-[#c084fc] py-3.5 text-lg font-bold text-white transition-all hover:shadow-[0_4px_20px_rgba(168,85,247,0.25)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#8a8a98]">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              type="button"
              onClick={() => switchMode(!isLogin)}
              className="cursor-pointer border-none bg-transparent font-semibold text-[#a855f7] hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Login;

