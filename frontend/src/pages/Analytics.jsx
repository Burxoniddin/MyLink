import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { FaLock, FaEye, FaMousePointer, FaShareAlt } from 'react-icons/fa';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const StatCard = ({ icon, label, value, color }) => (
    <div className="analytics-card">
        <div className="analytics-card-icon" style={{ color }}>{icon}</div>
        <div className="analytics-card-value">{value ?? 0}</div>
        <div className="analytics-card-label">{label}</div>
    </div>
);

const Analytics = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { entitlements } = useEntitlements();
    const [businesses, setBusinesses] = useState([]);
    const [selected, setSelected] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const level = entitlements?.features?.analytics || 'none';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        api.get('businesses/')
            .then((res) => {
                setBusinesses(res.data);
                if (res.data.length) setSelected(res.data[0].path);
            })
            .catch((err) => { if (err.response?.status === 401) navigate('/login'); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selected || level === 'none') return;
        setData(null);
        api.get(`businesses/${selected}/analytics/`)
            .then((res) => setData(res.data))
            .catch(() => setData(null));
    }, [selected, level]);

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }

    if (level === 'none') {
        return (
            <div className="dashboard">
                <main className="dashboard-main">
                    <div className="dashboard-container">
                        <div className="blocks-upsell">
                            <FaLock className="blocks-upsell-icon" />
                            <p>{t('analytics.upsell')}</p>
                            <Link to="/pricing" className="qr-dl">{t('limit.see_plans')}</Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const shortDate = (d) => (d ? d.slice(5) : '');

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container">
                    <div className="analytics-head">
                        <h1>{t('analytics.title')}</h1>
                        {businesses.length > 0 && (
                            <select className="analytics-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                                {businesses.map((b) => <option key={b.id} value={b.path}>{b.name}</option>)}
                            </select>
                        )}
                    </div>

                    {businesses.length === 0 ? (
                        <p className="blocks-empty">{t('analytics.no_business')}</p>
                    ) : !data ? (
                        <p className="blocks-empty">{t('common.loading')}</p>
                    ) : (
                        <>
                            <div className="analytics-cards">
                                <StatCard icon={<FaEye />} label={t('analytics.views')} value={data.totals.view} color="#4f46e5" />
                                <StatCard icon={<FaMousePointer />} label={t('analytics.clicks')} value={data.totals.click} color="#16a34a" />
                                <StatCard icon={<FaShareAlt />} label={t('analytics.shares')} value={data.totals.share} color="#d97706" />
                            </div>

                            <div className="analytics-chart">
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={data.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                        <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
                                        <YAxis allowDecimals={false} fontSize={12} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="view" name={t('analytics.views')} stroke="#4f46e5" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="click" name={t('analytics.clicks')} stroke="#16a34a" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {data.top_links && data.top_links.length > 0 && (
                                <div className="analytics-top">
                                    <h3>{t('analytics.top_links')}</h3>
                                    {data.top_links.map((l, i) => (
                                        <div key={i} className="top-link-row">
                                            <span>{l.label}</span>
                                            <strong>{l.clicks}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="analytics-window">{t('analytics.window', { days: data.days })}</p>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Analytics;
