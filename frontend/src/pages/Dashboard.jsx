import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaExternalLinkAlt, FaEdit } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
    const { t } = useTranslation();
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

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Main Content */}
            <main className="dashboard-main">
                <div className="dashboard-container">
                    <div className="dashboard-title-row">
                        <h1>{t('dashboard.title')}</h1>
                        <button className="add-btn" onClick={() => navigate('/business/new')}>
                            <FaPlus />
                            <span>{t('dashboard.add_new')}</span>
                        </button>
                    </div>

                    {businesses.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <h3>{t('dashboard.empty_title')}</h3>
                            <p>{t('dashboard.empty_desc')}</p>
                            <button className="add-btn-large" onClick={() => navigate('/business/new')}>
                                <FaPlus />
                                {t('dashboard.add_business')}
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
                                            <span className="card-path">mylink.asia/{biz.path}</span>
                                        </div>
                                    </div>
                                    {biz.description && (
                                        <p className="card-description">{biz.description}</p>
                                    )}
                                    <div className="card-stats">
                                        <span>{t('dashboard.link_count', { n: biz.links?.length || 0 })}</span>
                                    </div>
                                    <div className="card-actions">
                                        <button className="card-btn edit">
                                            <FaEdit /> {t('common.edit')}
                                        </button>
                                        <a
                                            href={`/${biz.path}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="card-btn view"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <FaExternalLinkAlt /> {t('common.view')}
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
