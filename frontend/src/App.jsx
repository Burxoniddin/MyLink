import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Pricing from './pages/Pricing';
import Analytics from './pages/Analytics';
import Referral from './pages/Referral';
import Nfc from './pages/Nfc';
import Dashboard from './pages/Dashboard';
import Catalogs from './pages/Catalogs';
import CatalogEditor from './pages/CatalogEditor';
import MenuPage from './pages/MenuPage';
import BusinessDetail from './pages/BusinessDetail';
import NewBusiness from './pages/NewBusiness';
import LandingPage from './pages/LandingPage';
import ComingSoon from './pages/ComingSoon';
import InfoPage from './pages/InfoPage';
import Blog from './pages/Blog';
import BlogPostPage from './pages/BlogPostPage';
import Navbar from './components/Navbar';
import HelpCTA from './components/HelpCTA';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Main Application with Navbar */}
        <Route path="/dashboard" element={<><Navbar /><Dashboard /></>} />
        <Route path="/catalogs" element={<><Navbar /><Catalogs /></>} />
        <Route path="/catalogs/:id" element={<><Navbar /><CatalogEditor /></>} />
        <Route path="/profile" element={<><Navbar /><Profile /></>} />
        <Route path="/analytics" element={<><Navbar /><Analytics /></>} />
        <Route path="/referral" element={<><Navbar /><Referral /></>} />
        <Route path="/nfc" element={<><Navbar /><Nfc /></>} />
        <Route path="/pricing" element={<><Navbar /><Pricing /></>} />

        {/* Business creation wizard + editor */}
        <Route path="/business/new" element={<><Navbar /><NewBusiness /></>} />
        <Route path="/business/:path/*" element={<><Navbar /><BusinessDetail /></>} />

        {/* Public content pages */}
        <Route path="/about" element={<InfoPage slug="about" />} />
        <Route path="/privacy" element={<InfoPage slug="privacy" />} />
        <Route path="/terms" element={<InfoPage slug="terms" />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />

        {/* Marketing landing — entry point */}
        <Route path="/" element={<HomePage />} />

        {/* Public web-menu (before the one-segment catch-all) */}
        <Route path="/:path/menu" element={<MenuPage />} />

        {/* Public business pages (catch-all, must be last) */}
        <Route path="/:path" element={<LandingPage />} />
      </Routes>
      <HelpCTA />
    </BrowserRouter>
  );
}

export default App;
