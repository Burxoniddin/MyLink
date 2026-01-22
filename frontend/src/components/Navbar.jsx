import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaLink, FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    const closeMenu = () => setMobileMenuOpen(false);

    return (
        <header className="navbar">
            <div className="navbar-container">
                <Link to="/dashboard" className="navbar-brand">
                    <img src="/logo.png" alt="MyLink" className="navbar-logo" />
                    <span>MyLink</span>
                </Link>

                {/* Desktop Menu */}
                <nav className="navbar-menu">
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>Bizneslarim</Link>
                    <Link to="/analytics" className={`nav-link ${isActive('/analytics')}`}>Analitika</Link>
                    <Link to="/referral" className={`nav-link ${isActive('/referral')}`}>Referal</Link>
                    <Link to="/pricing" className={`nav-link ${isActive('/pricing')}`}>Tariflar</Link>
                </nav>

                {/* Desktop Logout */}
                <button className="navbar-logout desktop-only" onClick={handleLogout}>
                    <FaSignOutAlt />
                    <span>Chiqish</span>
                </button>

                {/* Mobile Burger Button */}
                <button
                    className="mobile-menu-btn"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Menu"
                >
                    {mobileMenuOpen ? <FaTimes /> : <FaBars />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
                <div className="mobile-menu-overlay" onClick={closeMenu}>
                    <nav className="mobile-menu" onClick={(e) => e.stopPropagation()}>
                        <Link to="/dashboard" className={`mobile-nav-link ${isActive('/dashboard')}`} onClick={closeMenu}>
                            Bizneslarim
                        </Link>
                        <Link to="/analytics" className={`mobile-nav-link ${isActive('/analytics')}`} onClick={closeMenu}>
                            Analitika
                        </Link>
                        <Link to="/referral" className={`mobile-nav-link ${isActive('/referral')}`} onClick={closeMenu}>
                            Referal
                        </Link>
                        <Link to="/pricing" className={`mobile-nav-link ${isActive('/pricing')}`} onClick={closeMenu}>
                            Tariflar
                        </Link>
                        <button className="mobile-logout-btn" onClick={handleLogout}>
                            <FaSignOutAlt />
                            <span>Chiqish</span>
                        </button>
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Navbar;

