import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { FaPlus, FaLink, FaExternalLinkAlt, FaSignOutAlt, FaEdit } from 'react-icons/fa';

const Dashboard = () => {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        fetchBusinesses();
    }, []);

    const fetchBusinesses = async () => {
        try {
            const res = await api.get('businesses/');
            setBusinesses(res.data);
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

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Yuklanmoqda...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Main Content */}
            <main className="dashboard-main">
                <div className="dashboard-container">
                    <div className="dashboard-title-row">
                        <h1>Mening bizneslarim</h1>
                        <button className="add-btn" onClick={() => navigate('/business/new')}>
                            <FaPlus />
                            <span>Yangi qo'shish</span>
                        </button>
                    </div>

                    {businesses.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <h3>Hali biznes yo'q</h3>
                            <p>Birinchi biznesingizni qo'shing va linklar sahifangizni yarating</p>
                            <button className="add-btn-large" onClick={() => navigate('/business/new')}>
                                <FaPlus />
                                Biznes qo'shish
                            </button>
                        </div>
                    ) : (
                        <div className="business-grid">
                            {businesses.map((biz) => (
                                <div key={biz.id} className="business-card" onClick={() => navigate(`/business/${biz.path}`)}>
                                    <div className="card-header">
                                        {biz.logo ? (
                                            <img src={biz.logo} alt={biz.name} className="card-logo" />
                                        ) : (
                                            <div className="card-logo-placeholder">
                                                {biz.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="card-info">
                                            <h3>{biz.name}</h3>
                                            <span className="card-path">makanlink.uz/{biz.path}</span>
                                        </div>
                                    </div>
                                    {biz.description && (
                                        <p className="card-description">{biz.description}</p>
                                    )}
                                    <div className="card-stats">
                                        <span>{biz.links?.length || 0} link</span>
                                    </div>
                                    <div className="card-actions">
                                        <button className="card-btn edit">
                                            <FaEdit /> Tahrirlash
                                        </button>
                                        <a
                                            href={`/${biz.path}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="card-btn view"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <FaExternalLinkAlt /> Ko'rish
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
