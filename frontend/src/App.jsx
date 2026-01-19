import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BusinessDetail from './pages/BusinessDetail';
import LandingPage from './pages/LandingPage';
import ComingSoon from './pages/ComingSoon';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Main Application with Navbar */}
        <Route path="/dashboard" element={<><Navbar /><Dashboard /></>} />
        <Route path="/analytics" element={<><Navbar /><ComingSoon title="Analitika" /></>} />
        <Route path="/referral" element={<><Navbar /><ComingSoon title="Referal" /></>} />
        <Route path="/pricing" element={<><Navbar /><ComingSoon title="Tariflar" /></>} />

        {/* Business Detail with new Navbar */}
        <Route path="/business/:path/*" element={<><Navbar /><BusinessDetail /></>} />
        <Route path="/business/new" element={<><Navbar /><BusinessDetail isNew /></>} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public business pages */}
        <Route path="/:path" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
