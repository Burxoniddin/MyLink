import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaExternalLinkAlt, FaEdit, FaLock, FaLockOpen, FaStar } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';

const Dashboard = () => {
    const { t } = useTranslation();
    const { entitlements, refresh: refreshEntitlements } = useEntitlements();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [showUpgrade, setShowUpgrade] = useState(false);
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

    const limit = entitlements?.features?.profile_limit ?? 1;
    const activeCount = businesses.filter((b) => !b.is_locked).length;
    const atLimit = activeCount >= limit;
    const hasLocked = businesses.some((b) => b.is_locked);

    const handleAdd = () => {
        if (atLimit) {
            setShowUpgrade(true);
            return;
        }
        navigate('/business/new');
    };

    const toggleLock = async (e, biz) => {
        e.stopPropagation();
        setMsg('');
        try {
            await api.post(`businesses/${biz.path}/lock/`, { is_locked: !biz.is_locked });
            await Promise.all([fetchBusinesses(), refreshEntitlements()]);
        } catch (err) {
            if (err.response?.data?.reason === 'profile_limit') {
                setShowUpgrade(true);
            } else {
                setMsg(t('common.error'));
            }
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
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h1>{t('dashboard.title')}</h1>
                            <span style={{ color: atLimit ? '#dc2626' : '#6b7280', fontWeight: 600, fontSize: 14 }}>
                                {activeCount}/{limit}
                            </span>
                        </div>
                        <button className="add-btn" onClick={handleAdd} disabled={atLimit}
                            style={atLimit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                            title={atLimit ? t('limit.reached', { limit }) : undefined}>
                            <FaPlus />
                            <span>{t('dashboard.add_new')}</span>
                        </button>
                    </div>

                    {msg && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                            background: '#fef3c7', color: '#92400e', fontSize: 14,
                        }}>{msg}</div>
                    )}

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
                                <div key={biz.id} className="business-card"
                                    style={biz.is_locked ? { opacity: 0.6 } : undefined}
                                    onClick={() => navigate(`/business/${biz.path}`)}>
                                    {biz.is_locked && (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: '#fee2e2', color: '#991b1b', fontSize: 12, fontWeight: 600,
                                            padding: '3px 10px', borderRadius: 999, marginBottom: 10,
                                        }}>
                                            <FaLock size={11} /> {t('limit.locked_badge')}
                                        </div>
                                    )}
                                    {biz.is_pinned && !biz.is_locked && (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600,
                                            padding: '3px 10px', borderRadius: 999, marginBottom: 10,
                                        }}>
                                            <FaStar size={11} /> {t('detail.pinned')}
                                        </div>
                                    )}
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
                                        {biz.is_locked ? (
                                            <button className="card-btn view" onClick={(e) => toggleLock(e, biz)}>
                                                <FaLockOpen /> {t('limit.activate')}
                                            </button>
                                        ) : hasLocked ? (
                                            <button className="card-btn view" onClick={(e) => toggleLock(e, biz)}>
                                                <FaLock /> {t('limit.deactivate')}
                                            </button>
                                        ) : (
                                            <a
                                                href={`/${biz.path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="card-btn view"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <FaExternalLinkAlt /> {t('common.view')}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {showUpgrade && (
                <div
                    onClick={() => setShowUpgrade(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: 16,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%',
                            boxShadow: '0 20px 60px -20px rgba(0,0,0,0.4)', textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
                        <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>{t('limit.modal_title')}</h2>
                        <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: 15, lineHeight: 1.5 }}>
                            {t('limit.modal_text', { limit })}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <button
                                className="add-btn"
                                style={{ justifyContent: 'center' }}
                                onClick={() => navigate('/pricing')}
                            >
                                {t('limit.see_plans')}
                            </button>
                            <button
                                onClick={() => navigate('/profile')}
                                style={{
                                    padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7eb',
                                    background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                {t('limit.enter_promo')}
                            </button>
                            <button
                                onClick={() => setShowUpgrade(false)}
                                style={{
                                    padding: '8px', border: 'none', background: 'none',
                                    color: '#9ca3af', fontSize: 14, cursor: 'pointer',
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
