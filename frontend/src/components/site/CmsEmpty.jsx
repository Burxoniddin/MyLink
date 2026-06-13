import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Friendly "content coming soon" state for CMS pages with nothing published yet.
const CmsEmpty = ({ icon = '✍️' }) => {
    const { t } = useTranslation();
    return (
        <div className="cms-empty">
            <div className="cms-empty-art">
                <span className="cea-blob b1"></span>
                <span className="cea-blob b2"></span>
                <span className="cea-icon">{icon}</span>
            </div>
            <h2>{t('cms.empty_title')}</h2>
            <p>{t('cms.empty_text')}</p>
            <Link to="/" className="btn btn-primary">{t('cms.go_home')}</Link>
        </div>
    );
};

export default CmsEmpty;
