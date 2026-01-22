import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { FaLink, FaUser, FaChartBar, FaCog, FaSignOutAlt } from 'react-icons/fa';
import api from '../api';

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        fetchBusiness();
    }, []);

    const fetchBusiness = async () => {
        try {
            const res = await api.get('businesses/');
            if (res.data.length > 0) {
                setBusiness(res.data[0]); // Get first/only business
            }
        } catch (err) {
            if (err.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const currentTab = location.pathname.split('/').pop();

    const topTabs = [
        { id: 'preview', label: 'Preview' },
        { id: 'edit', label: 'Edit' },
        { id: 'customize', label: 'Customize' },
        { id: 'advanced', label: 'Advanced' },
        { id: 'upgrade', label: 'Upgrade' },
    ];

    const sidebarItems = [
        { id: 'preview', icon: <FaLink />, tooltip: 'My Link' },
        { id: 'profile', icon: <FaUser />, tooltip: 'Profile' },
        { id: 'analytics', icon: <FaChartBar />, tooltip: 'Analytics' },
        { id: 'settings', icon: <FaCog />, tooltip: 'Settings' },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            </div>
        );
    }

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <FaLink size={24} />
                </div>

                <nav className="sidebar-nav">
                    {sidebarItems.map(item => (
                        <Link
                            key={item.id}
                            to={`/app/${item.id}`}
                            className={`sidebar-item ${currentTab === item.id ? 'active' : ''}`}
                            title={item.tooltip}
                        >
                            {item.icon}
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <button
                        className="sidebar-item"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Top Navigation */}
                <header className="top-nav">
                    <nav className="top-tabs">
                        {topTabs.map(tab => (
                            <Link
                                key={tab.id}
                                to={`/app/${tab.id}`}
                                className={`top-tab ${currentTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.label}
                            </Link>
                        ))}
                    </nav>

                    {/* URL Bar */}
                    {business && (
                        <div className="url-bar">
                            <span className="url-text">
                                mylink.asia/{business.path}
                            </span>
                            <button
                                className="copy-btn"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/${business.path}`);
                                    alert('Link copied!');
                                }}
                            >
                                📋
                            </button>
                        </div>
                    )}
                </header>

                {/* Page Content */}
                <div className="page-content">
                    <Outlet context={{ business, setBusiness, fetchBusiness }} />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
