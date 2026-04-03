import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Marketplace from './pages/Marketplace';
import Merchant from './pages/Merchant';
import Freelance from './pages/Freelance';
import ApiIntegration from './pages/ApiIntegration';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-[#0a0a0c] text-white font-['Inter',system-ui,sans-serif]">
          <Navbar />
          <main className="flex-1 pt-20"> {/* added pt-20 so routes dont hide under navbar */}
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/marketplace" element={<Marketplace />} />
              
              {/* Protected Merchant Dashboard */}
              <Route element={<ProtectedRoute allowedRole="merchant" />}>
                <Route path="/merchant" element={<Merchant />} />
              </Route>
              
              <Route path="/freelance" element={<Freelance />} />
              <Route path="/api" element={<ApiIntegration />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
