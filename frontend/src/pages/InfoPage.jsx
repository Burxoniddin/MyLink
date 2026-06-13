import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SiteHeader from '../components/site/SiteHeader';
import SiteFooter from '../components/site/SiteFooter';
import CmsEmpty from '../components/site/CmsEmpty';
import './HomePage.css';
import './Content.css';

const ICONS = { about: '🚀', privacy: '🔐', terms: '📋' };

const InfoPage = ({ slug }) => {
    const { t, i18n } = useTranslation();
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`pages/${slug}/?lang=${i18n.language}`)
            .then((r) => setPage(r.data))
            .catch(() => setPage(null))
            .finally(() => setLoading(false));
    }, [slug, i18n.language]);

    return (
        <div className="lpc cms-page">
            <SiteHeader />
            <main className="cms-main">
                {loading ? (
                    <p className="cms-loading">{t('common.loading')}</p>
                ) : page ? (
                    <article className="info-content wrap-narrow">
                        <h1>{page.title}</h1>
                        <div dangerouslySetInnerHTML={{ __html: page.body }} />
                    </article>
                ) : (
                    <CmsEmpty icon={ICONS[slug] || '✍️'} />
                )}
            </main>
            <SiteFooter />
        </div>
    );
};

export default InfoPage;
