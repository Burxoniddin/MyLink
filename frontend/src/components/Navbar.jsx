import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaLink, FaSignOutAlt } from 'react-icons/fa';

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <header className="navbar">
            <div className="navbar-container">
                <Link to="/dashboard" className="navbar-brand">
                    <img src="/logo.png" alt="MyLink" className="navbar-logo" />
                    <span>MyLink</span>
                </Link>

                <nav className="navbar-menu">
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>Bizneslarim</Link>
                    <Link to="/analytics" className={`nav-link ${isActive('/analytics')}`}>Analitika</Link>
                    <Link to="/referral" className={`nav-link ${isActive('/referral')}`}>Referal</Link>
                    <Link to="/pricing" className={`nav-link ${isActive('/pricing')}`}>Tariflar</Link>
                </nav>

                <button className="navbar-logout" onClick={handleLogout}>
                    <FaSignOutAlt />
                    <span>Chiqish</span>
                </button>
            </div>
        </header>
    );
};

export default Navbar;
