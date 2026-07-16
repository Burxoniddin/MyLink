import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaExternalLinkAlt, FaEdit, FaLock, FaStar, FaRegStar, FaSearch, FaUsers } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';

const Dashboard = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const { entitlements, refresh: refreshEntitlements } = useEntitlements();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [query, setQuery] = useState('');
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

    // The tier limit applies only to pages you own; pages shared with you
    // (role !== 'owner') don't count toward it. Creation is unlimited — the
    // limit caps how many can be ACTIVE at once.
    const owned = businesses.filter((b) => b.role === 'owner');
    const limit = entitlements?.features?.profile_limit ?? 1;
    const activeCount = owned.filter((b) => !b.is_locked).length;
    const atLimit = activeCount >= limit;

    const q = query.trim().toLowerCase();
    const filtered = q
        ? businesses.filter((b) => b.name.toLowerCase().includes(q) || b.path.toLowerCase().includes(q))
        : businesses;

    const handleAdd = () => navigate('/business/new');

    const toggleLock = async (e, biz) => {
        e.stopPropagation();
        try {
            await api.post(`businesses/${biz.path}/lock/`, { is_locked: !biz.is_locked });
            toast.success(biz.is_locked ? t('limit.activated') : t('limit.deactivated'));
            await Promise.all([fetchBusinesses(), refreshEntitlements()]);
        } catch (err) {
            if (err.response?.data?.reason === 'profile_limit') {
                setShowUpgrade(true);
            } else {
                toast.error(t('common.error'));
            }
        }
    };

    // Pin/"qadash": optimistic star toggle, then refetch so pinned pages
    // float to the top (backend orders by -is_pinned).
    const togglePin = async (e, biz) => {
        e.stopPropagation();
        const next = !biz.is_pinned;
        setBusinesses((bs) => bs.map((b) => (b.id === biz.id ? { ...b, is_pinned: next } : b)));
        try {
            await api.post(`businesses/${biz.path}/pin/`, { is_pinned: next });
            await fetchBusinesses();
        } catch {
            setBusinesses((bs) => bs.map((b) => (b.id === biz.id ? { ...b, is_pinned: !next } : b)));
            toast.error(t('common.error'));
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
                        <button className="add-btn" onClick={handleAdd}
                            title={atLimit ? t('limit.add_inactive_hint') : undefined}>
                            <FaPlus />
                            <span>{t('dashboard.add_new')}</span>
                        </button>
                    </div>

                    {businesses.length > 1 && (
                        <div className="dashboard-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder={t('dashboard.search_ph')}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
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
                    ) : filtered.length === 0 ? (
                        <p className="blocks-empty">{t('dashboard.no_results')}</p>
                    ) : (
                        <div className="business-grid">
                            {filtered.map((biz) => (
                                <div key={biz.id} className="business-card"
                                    style={biz.is_locked && biz.role === 'owner' ? { opacity: 0.65 } : undefined}
                                    onClick={() => navigate(`/business/${biz.path}`)}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 24 }}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {biz.role !== 'owner' && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    background: '#ede9fe', color: '#5b21b6', fontSize: 12, fontWeight: 600,
                                                    padding: '3px 10px', borderRadius: 999,
                                                }}>
                                                    <FaUsers size={11} /> {t(`team.role_${biz.role}`)}
                                                </span>
                                            )}
                                            {biz.role === 'owner' && biz.is_locked && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    background: '#fee2e2', color: '#991b1b', fontSize: 12, fontWeight: 600,
                                                    padding: '3px 10px', borderRadius: 999,
                                                }}>
                                                    <FaLock size={11} /> {t('limit.locked_badge')}
                                                </span>
                                            )}
                                        </div>
                                        {biz.role === 'owner' && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <button
                                                    type="button"
                                                    className={`pin-star ${biz.is_pinned ? 'on' : ''}`}
                                                    onClick={(e) => togglePin(e, biz)}
                                                    title={biz.is_pinned ? t('detail.pinned') : t('detail.pin')}
                                                    aria-label={biz.is_pinned ? t('detail.pinned') : t('detail.pin')}
                                                >
                                                    {biz.is_pinned ? <FaStar /> : <FaRegStar />}
                                                </button>
                                                <span
                                                    className={`biz-switch ${biz.is_locked ? '' : 'on'}`}
                                                    onClick={(e) => toggleLock(e, biz)}
                                                    title={biz.is_locked ? t('limit.activate') : t('limit.deactivate')}
                                                    role="switch"
                                                    aria-checked={!biz.is_locked}
                                                >
                                                    <span className="sw-label">{biz.is_locked ? t('limit.inactive') : t('limit.active')}</span>
                                                    <span className="track"></span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
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
                                            style={biz.is_locked ? { pointerEvents: 'none', opacity: .5 } : undefined}
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
