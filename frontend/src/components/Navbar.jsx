import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaBars, FaTimes, FaUserCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useEntitlements } from '../context/EntitlementContext';

const TIER_BADGES = {
    free: { bg: '#f3f4f6', fg: '#374151' },
    oddiy: { bg: '#dbeafe', fg: '#1e40af' },
    pro: { bg: '#fef3c7', fg: '#92400e' },
};

const TierPill = ({ tier, t }) => {
    const badge = TIER_BADGES[tier] || TIER_BADGES.free;
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: badge.bg, color: badge.fg,
        }}>{t(`promo.tier_${tier}`)}</span>
    );
};

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { entitlements } = useEntitlements();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const isActive = (path) => (location.pathname === path ? 'active' : '');

    const closeMenu = () => setMobileMenuOpen(false);

    const tier = entitlements?.tier || 'free';

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
                    <Link to="/nfc" className={`nav-link ${isActive('/nfc')}`}>{t('nav.nfc')}</Link>
                    <Link to="/pricing" className={`nav-link ${isActive('/pricing')}`}>{t('nav.pricing')}</Link>
                </nav>

                {/* Desktop right side */}
                <div className="navbar-right desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <LanguageSwitcher />
                    <Link to="/profile" className={`nav-link ${isActive('/profile')}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FaUserCircle style={{ fontSize: 18 }} />
                        <span>{t('nav.profile')}</span>
                        <TierPill tier={tier} t={t} />
                    </Link>
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
                        <Link to="/nfc" className={`mobile-nav-link ${isActive('/nfc')}`} onClick={closeMenu}>
                            {t('nav.nfc')}
                        </Link>
                        <Link to="/pricing" className={`mobile-nav-link ${isActive('/pricing')}`} onClick={closeMenu}>
                            {t('nav.pricing')}
                        </Link>
                        <Link to="/profile" className={`mobile-nav-link ${isActive('/profile')}`} onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaUserCircle />
                            <span>{t('nav.profile')}</span>
                            <TierPill tier={tier} t={t} />
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
