import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Marketplace from './pages/Marketplace';
import Merchant from './pages/Merchant';
import Freelance from './pages/Freelance';
import ApiIntegration from './pages/ApiIntegration';
import './App.css';

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-[#0a0a0c] text-white font-['Inter',system-ui,sans-serif]">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/merchant" element={<Merchant />} />
            <Route path="/freelance" element={<Freelance />} />
            <Route path="/api" element={<ApiIntegration />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
