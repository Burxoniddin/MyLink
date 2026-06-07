import React from 'react';
import { FaClock } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const ComingSoon = ({ title, titleKey }) => {
    const { t } = useTranslation();
    const resolvedTitle = titleKey ? t(titleKey) : title;
    return (
        <div className="coming-soon">
            <div className="coming-soon-icon">
                <FaClock />
            </div>
            <h2>{t('coming_soon.title')}</h2>
            <p>{t('coming_soon.desc', { title: resolvedTitle })}</p>
            <span className="coming-soon-badge">{t('coming_soon.badge')}</span>
        </div>
    );
};

export default ComingSoon;
