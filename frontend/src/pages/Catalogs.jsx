import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';
import { FaBookOpen, FaLink as FaLinkIcon, FaLock, FaPlus, FaUnlink } from 'react-icons/fa';
import '../components/catalog/catalog.css';

/**
 * "Kataloglarim" — standalone catalog list (navbar section). Catalogs are
 * created here and attached to one of the user's businesses inside the editor.
 */
const Catalogs = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const { entitlements } = useEntitlements();
    const [catalogs, setCatalogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const canCatalog = !!entitlements?.features?.catalog;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        api.get('catalogs/')
            .then((res) => setCatalogs(res.data))
            .catch((err) => { if (err.response?.status === 401) navigate('/login'); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Create with a default name and jump straight into the editor.
    const addCatalog = async () => {
        if (creating) return;
        setCreating(true);
        try {
            const res = await api.post('catalogs/', { name: t('catalog.new_name') });
            navigate(`/catalogs/${res.data.id}`);
        } catch (err) {
            const reason = err.response?.data?.reason;
            toast.error(reason === 'catalog' ? t('catalog.err_catalog') : t('common.error'));
            setCreating(false);
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container">
                    {!canCatalog && (
                        <div className="blocks-upsell">
                            <FaLock className="blocks-upsell-icon" />
                            <p>{t('catalog.upsell')}</p>
                            <Link to="/pricing" className="qr-dl">{t('limit.see_plans')}</Link>
                        </div>
                    )}

                    {(canCatalog || catalogs.length > 0) && (
                        <>
                            <div className="dashboard-title-row">
                                <h1>{t('catalog.title')}</h1>
                                {canCatalog && (
                                    <button className="add-btn" onClick={addCatalog} disabled={creating}>
                                        <FaPlus />
                                        <span>{t('catalog.add')}</span>
                                    </button>
                                )}
                            </div>

                            {catalogs.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">📖</div>
                                    <h3>{t('catalog.empty_title')}</h3>
                                    <p>{t('catalog.empty_desc')}</p>
                                    <button className="add-btn-large" onClick={addCatalog} disabled={creating}>
                                        <FaPlus />
                                        {t('catalog.add')}
                                    </button>
                                </div>
                            ) : (
                                <div className="business-grid">
                                    {catalogs.map((c) => (
                                        <div key={c.id} className="business-card cat-card"
                                            style={!c.is_active ? { opacity: 0.65 } : undefined}
                                            onClick={() => navigate(`/catalogs/${c.id}`)}>
                                            <div className="cat-card-banner">
                                                {c.banner ? <img src={c.banner} alt="" /> : <FaBookOpen />}
                                            </div>
                                            <div className="card-info">
                                                <h3>{c.name}</h3>
                                                {c.business_path ? (
                                                    <span className="cat-badge cat-badge-ok">
                                                        <FaLinkIcon size={11} /> mylink.asia/{c.business_path}/menu
                                                    </span>
                                                ) : (
                                                    <span className="cat-badge cat-badge-warn">
                                                        <FaUnlink size={11} /> {t('catalog.not_attached')}
                                                    </span>
                                                )}
                                                <p className="cat-card-meta">
                                                    {t('catalog.card_counts', { c: c.categories_count, i: c.items_count })}
                                                    {!c.is_active && <> · {t('catalog.inactive')}</>}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Catalogs;
