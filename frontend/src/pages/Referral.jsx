import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { FaCopy, FaCheck, FaShareAlt, FaUserPlus, FaCrown, FaGift } from 'react-icons/fa';

const StatCard = ({ icon, value, label, color }) => (
    <div className="analytics-card">
        <div className="analytics-card-icon" style={{ color }}>{icon}</div>
        <div className="analytics-card-value">{value}</div>
        <div className="analytics-card-label">{label}</div>
    </div>
);

const Referral = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        api.get('referral/')
            .then((res) => setData(res.data))
            .catch((err) => { if (err.response?.status === 401) navigate('/login'); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const copy = async () => {
        if (!data) return;
        try {
            await navigator.clipboard.writeText(data.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard unavailable */ }
    };

    const share = async () => {
        if (!data) return;
        if (navigator.share) {
            try { await navigator.share({ title: 'MyLink', url: data.link }); } catch { /* dismissed */ }
        } else {
            copy();
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }
    if (!data) return null;

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container" style={{ maxWidth: 680 }}>
                    <h1 style={{ marginBottom: 8 }}>{t('referral.title')}</h1>
                    <p className="referral-lead">{t('referral.lead', { cap: data.cap })}</p>

                    <div className="referral-link-card">
                        <label>{t('referral.your_link')}</label>
                        <div className="referral-link-row">
                            <input readOnly value={data.link} onFocus={(e) => e.target.select()} />
                            <button type="button" className="referral-copy" onClick={copy}>
                                {copied ? <FaCheck /> : <FaCopy />} {copied ? t('detail.copied') : t('referral.copy')}
                            </button>
                        </div>
                        <button type="button" className="referral-share-btn" onClick={share}>
                            <FaShareAlt /> {t('detail.share')}
                        </button>
                    </div>

                    <div className="analytics-cards">
                        <StatCard icon={<FaUserPlus />} value={data.total_referred} label={t('referral.invited')} color="#4f46e5" />
                        <StatCard icon={<FaCrown />} value={data.converted} label={t('referral.converted')} color="#d97706" />
                        <StatCard icon={<FaGift />} value={`${data.months_earned}/${data.cap}`} label={t('referral.months')} color="#16a34a" />
                    </div>

                    <div className="referral-how">
                        <h3>{t('referral.how_title')}</h3>
                        <ol>
                            <li>{t('referral.how_1')}</li>
                            <li>{t('referral.how_2')}</li>
                            <li>{t('referral.how_3')}</li>
                        </ol>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Referral;
