import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';
import { Ic } from '../components/catalog/icons';
import { getCatalogTheme } from '../lib/catalogThemes';
import '../components/catalog/catalog.css';

const PUBLIC_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.host
    : 'mylink.asia';

const KatCard = ({ cat, onToggle, onOpen, t, toast }) => {
    const th = getCatalogTheme(cat.theme);
    const menuUrl = cat.business_path ? `${PUBLIC_HOST}/${cat.business_path}/menu` : null;
    const copy = (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(`${window.location.protocol}//${menuUrl}`);
        toast.success(t('catalog.link_copied'));
    };
    return (
        <div className="mc-kat">
            <div
                className="mc-katban"
                style={{ backgroundImage: cat.banner ? undefined : `linear-gradient(135deg, ${th.sw[0]}, ${th.sw[1]})` }}
            >
                {cat.banner
                    ? <img src={cat.banner} alt="" />
                    : <span className="mc-katbnote">{t('catalog.banner')}</span>}
            </div>
            <div className="mc-katb">
                <b className="mc-katnom">{cat.name}</b>
                {menuUrl ? (
                    <span className="mc-link ok">
                        <Ic n="check" s={12} w={2.4} />{menuUrl}
                        <button type="button" className="mc-linkcp" onClick={copy} aria-label={t('catalog.copy')}>
                            <Ic n="copy" s={12} />
                        </button>
                    </span>
                ) : (
                    <span className="mc-link warn">
                        <Ic n="warn" s={12} w={2} />{t('catalog.not_attached')}
                    </span>
                )}
                <span className="mc-katmeta">
                    {t('catalog.card_counts', { c: cat.categories_count, i: cat.items_count })}
                </span>
                <div className="mc-katfoot">
                    <button
                        type="button" className={`mc-tgl${cat.is_active ? ' on' : ''}`}
                        onClick={() => onToggle(cat)} aria-label={t('catalog.active')}
                    >
                        <span />
                    </button>
                    <span className="mc-tgll">{cat.is_active ? t('catalog.active_on') : t('catalog.inactive')}</span>
                    <button type="button" className="mc-btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => onOpen(cat)}>
                        {t('common.edit')}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * "Kataloglarim" — the standalone catalog list in the navbar. Catalogs are
 * created here and attached to one of the user's businesses in the editor.
 */
const Catalogs = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const { entitlements } = useEntitlements();
    const [catalogs, setCatalogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [creating, setCreating] = useState(false);

    const canCatalog = !!entitlements?.features?.catalog;

    const load = () => {
        setFailed(false);
        api.get('catalogs/')
            // Guard the shape: anything but a list (an error envelope, a future
            // paginated response) must not leave the page rendering nothing.
            .then((res) => setCatalogs(Array.isArray(res.data) ? res.data : []))
            .catch((err) => {
                if (err.response?.status === 401) navigate('/login');
                else setFailed(true);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Create with a default name and drop straight into the editor.
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

    const toggleActive = async (cat) => {
        const next = !cat.is_active;
        setCatalogs((cs) => cs.map((c) => (c.id === cat.id ? { ...c, is_active: next } : c)));
        try {
            await api.patch(`catalogs/${cat.id}/`, { is_active: next });
        } catch (err) {
            setCatalogs((cs) => cs.map((c) => (c.id === cat.id ? { ...c, is_active: !next } : c)));
            const reason = err.response?.data?.reason;
            toast.error(reason === 'catalog' ? t('catalog.err_catalog') : t('common.error'));
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }

    const hero = (icon, soft, title, desc, actions) => (
        <div className="mc-hero">
            <span className={`mc-lockc${soft ? ' soft' : ''}`}><Ic n={icon} s={24} w={1.7} /></span>
            <h2>{title}</h2>
            <p>{desc}</p>
            <div className="mc-heroraw">{actions}</div>
        </div>
    );

    const grid = (
        <div className="mc-grid">
            {catalogs.map((c) => (
                <KatCard
                    key={c.id} cat={c} t={t} toast={toast}
                    onToggle={toggleActive}
                    onOpen={(cat) => navigate(`/catalogs/${cat.id}`)}
                />
            ))}
            {canCatalog && (
                <button type="button" className="mc-add" onClick={addCatalog} disabled={creating}>
                    <Ic n="plus" s={20} w={2} />{t('catalog.add_new')}
                </button>
            )}
        </div>
    );

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container cat-scope">
                    {failed ? (
                        hero('warn', true, t('common.error'), t('catalog.load_failed'), (
                            <button type="button" className="mc-btn grad" onClick={() => { setLoading(true); load(); }}>
                                {t('catalog.retry')}
                            </button>
                        ))
                    ) : !canCatalog ? (
                        /* Every non-Pro visit explains the upsell first; any catalogs
                           kept from an earlier Pro period still list underneath. */
                        <>
                            {hero('lock', false, t('catalog.upsell_title'),
                                catalogs.length ? t('catalog.downgraded_note') : t('catalog.upsell'), (
                                    <Link to="/pricing" className="mc-btn grad">{t('limit.see_plans')}</Link>
                                ))}
                            {catalogs.length > 0 && (
                                <>
                                    <div className="mc-head"><h1>{t('catalog.title')}</h1></div>
                                    {grid}
                                </>
                            )}
                        </>
                    ) : catalogs.length === 0 ? (
                        hero('book', true, t('catalog.empty_title'), t('catalog.empty_desc'), (
                            <button type="button" className="mc-btn grad" onClick={addCatalog} disabled={creating}>
                                <Ic n="plus" s={15} w={2.2} />{t('catalog.add')}
                            </button>
                        ))
                    ) : (
                        <>
                            <div className="mc-head">
                                <h1>{t('catalog.title')}</h1>
                                <button type="button" className="mc-btn grad" onClick={addCatalog} disabled={creating}>
                                    <Ic n="plus" s={15} w={2.2} />{t('catalog.add')}
                                </button>
                            </div>
                            {grid}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Catalogs;
