import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Content.css';

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
        <div className="info-page">
            <div className="info-bar">
                <Link to="/" className="info-brand">← MyLink</Link>
                <LanguageSwitcher />
            </div>
            <article className="info-content">
                {loading ? (
                    <p>{t('common.loading')}</p>
                ) : page ? (
                    <>
                        <h1>{page.title}</h1>
                        <div dangerouslySetInnerHTML={{ __html: page.body }} />
                    </>
                ) : (
                    <p>{t('landing.not_found_title')}</p>
                )}
            </article>
        </div>
    );
};

export default InfoPage;
