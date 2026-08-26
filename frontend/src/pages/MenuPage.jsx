import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import CatalogMenu from '../components/catalog/CatalogMenu';
import { themeTexture, themeVars } from '../lib/catalogThemes';
import './MenuPage.css';

/**
 * Public mini web-menu at /:path/menu — the page a restaurant's table QR opens.
 * Fetching and the not-found state live here; the menu itself is CatalogMenu,
 * shared with the editor's live preview.
 */
const MenuPage = () => {
    const { path } = useParams();
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        api.get(`public/${path}/catalog/`)
            .then((res) => {
                if (!active) return;
                setData(res.data);
                document.title = `${res.data.business.name} — ${res.data.button_label || t('landing.menu_button')}`;
            })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    if (loading) {
        return (
            <div className="menu-root" style={themeVars('mylink', 'dark')}>
                <div className="menu-spinner" />
            </div>
        );
    }

    // A missing/disabled catalog, an expired Pro plan and a locked page all 404
    // the same way — the visitor just gets sent back to the business page.
    if (error || !data) {
        return (
            <div className="menu-root" style={themeVars('mylink', 'dark')}>
                <span className="menu-tex" style={themeTexture('mylink', 'dark')} />
                <div className="menu-scroll">
                    <div className="menu-state">
                        <span className="menu-stbig">404</span>
                        <h3>{t('menu.not_found')}</h3>
                        <p>{t('menu.not_found_desc')}</p>
                        <Link to={`/${path}`} className="menu-stbtn">{t('menu.back')}</Link>
                    </div>
                </div>
            </div>
        );
    }

    return <CatalogMenu data={data} />;
};

export default MenuPage;
