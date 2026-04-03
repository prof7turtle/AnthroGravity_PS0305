import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Marketplace from './pages/Marketplace';
import Merchant from './pages/Merchant';
import Workflows from './pages/Freelance';
import ApiIntegration from './pages/ApiIntegration';
import Login from './pages/Login';
import EscrowDetail from './pages/EscrowDetail.tsx';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function AppLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c] text-white font-['Inter',system-ui,sans-serif]">
      <Navbar />
      <main className={isLandingPage ? 'flex-1' : 'flex-1 pt-24'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/escrow/:appId" element={<EscrowDetail />} />

          {/* Protected Merchant Dashboard */}
          <Route element={<ProtectedRoute allowedRole="merchant" />}>
            <Route path="/merchant" element={<Merchant />} />
          </Route>

          <Route path="/workflows" element={<Workflows />} />
          <Route path="/freelance" element={<Navigate to="/workflows" replace />} />
          <Route path="/api" element={<ApiIntegration />} />
          <Route path="/escrow/:appId" element={<EscrowDetail />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;
