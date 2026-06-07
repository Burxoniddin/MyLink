import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const isActive = (path) => (location.pathname === path ? 'active' : '');

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
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>{t('nav.businesses')}</Link>
                    <Link to="/analytics" className={`nav-link ${isActive('/analytics')}`}>{t('nav.analytics')}</Link>
                    <Link to="/referral" className={`nav-link ${isActive('/referral')}`}>{t('nav.referral')}</Link>
                    <Link to="/pricing" className={`nav-link ${isActive('/pricing')}`}>{t('nav.pricing')}</Link>
                </nav>

                {/* Desktop right side */}
                <div className="navbar-right desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <LanguageSwitcher />
                    <button className="navbar-logout" onClick={handleLogout}>
                        <FaSignOutAlt />
                        <span>{t('nav.logout')}</span>
                    </button>
                </div>

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
                            {t('nav.businesses')}
                        </Link>
                        <Link to="/analytics" className={`mobile-nav-link ${isActive('/analytics')}`} onClick={closeMenu}>
                            {t('nav.analytics')}
                        </Link>
                        <Link to="/referral" className={`mobile-nav-link ${isActive('/referral')}`} onClick={closeMenu}>
                            {t('nav.referral')}
                        </Link>
                        <Link to="/pricing" className={`mobile-nav-link ${isActive('/pricing')}`} onClick={closeMenu}>
                            {t('nav.pricing')}
                        </Link>
                        <div style={{ padding: '12px 16px' }}>
                            <LanguageSwitcher />
                        </div>
                        <button className="mobile-logout-btn" onClick={handleLogout}>
                            <FaSignOutAlt />
                            <span>{t('nav.logout')}</span>
                        </button>
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Navbar;
