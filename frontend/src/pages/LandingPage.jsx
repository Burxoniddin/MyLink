import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import ClassicTemplate from '../components/templates/ClassicTemplate';
import ProfileTemplate from '../components/templates/ProfileTemplate';
import { TEMPLATE_META } from '../components/templates/templateMeta';
import { getMediaUrl, toEmbed } from '../lib/media';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
    const { path } = useParams();
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const viewTracked = useRef('');

    // Fire-and-forget analytics beacon; never breaks the visitor's page.
    const track = (event_type, label = '') => {
        api.post('track/', { path, event_type, label }).catch(() => {});
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`public/${path}/`);
                setData(res.data);
                if (viewTracked.current !== path) {
                    viewTracked.current = path; // once per path (guards StrictMode double-mount)
                    track('view');
                }
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    if (loading) {
        return (
            <div className="landing-page">
                <div className="landing-loading">
                    <div className="landing-spinner"></div>
                    <p>{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="landing-page">
                <div className="landing-error">
                    <div className="error-icon">🔍</div>
                    <h2>{t('landing.not_found_title')}</h2>
                    <p>{t('landing.not_found_desc')}</p>
                </div>
            </div>
        );
    }

    // Sector-themed templates render their own full-page layout.
    const tpl = data.template || 'classic';
    if (tpl !== 'classic') {
        return (
            <ProfileTemplate
                data={data}
                tpl={tpl}
                theme={data.theme_mode || TEMPLATE_META[tpl]?.defaultTheme || 'dark'}
                onLinkClick={(title) => track('click', title)}
                getLogoUrl={getMediaUrl}
                toEmbed={toEmbed}
                t={t}
            />
        );
    }

    return (
        <ClassicTemplate
            data={data}
            onLinkClick={(title) => track('click', title)}
            getLogoUrl={getMediaUrl}
            toEmbed={toEmbed}
            t={t}
        />
    );
};

export default LandingPage;
