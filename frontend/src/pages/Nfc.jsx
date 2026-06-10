import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { FaWifi, FaCheckCircle } from 'react-icons/fa';

const STATUS_COLOR = {
    new: { bg: '#dbeafe', fg: '#1e40af' },
    processing: { bg: '#fef3c7', fg: '#92400e' },
    done: { bg: '#dcfce7', fg: '#166534' },
    canceled: { bg: '#fee2e2', fg: '#991b1b' },
};

const Nfc = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ full_name: '', phone: '', quantity: 1, note: '' });
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        api.get('nfc/orders/')
            .then((res) => setOrders(res.data))
            .catch((err) => { if (err.response?.status === 401) navigate('/login'); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await api.post('nfc/orders/', { ...form, quantity: Number(form.quantity) || 1 });
            setOrders([res.data, ...orders]);
            setForm({ full_name: '', phone: '', quantity: 1, note: '' });
            setMsg({ type: 'success', text: t('nfc.sent') });
        } catch {
            setMsg({ type: 'error', text: t('common.error') });
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container" style={{ maxWidth: 700 }}>
                    <div className="nfc-hero">
                        <FaWifi className="nfc-hero-icon" />
                        <h1>{t('nfc.title')}</h1>
                        <p>{t('nfc.lead')}</p>
                        <ul className="nfc-benefits">
                            <li><FaCheckCircle /> {t('nfc.benefit_1')}</li>
                            <li><FaCheckCircle /> {t('nfc.benefit_2')}</li>
                            <li><FaCheckCircle /> {t('nfc.benefit_3')}</li>
                        </ul>
                    </div>

                    <div className="nfc-form-card">
                        <h3>{t('nfc.order_title')}</h3>
                        {msg.text && (
                            <div style={{
                                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                                background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
                                color: msg.type === 'success' ? '#166534' : '#991b1b', fontSize: 14,
                            }}>{msg.text}</div>
                        )}
                        <form onSubmit={submit}>
                            <div className="input-group">
                                <label>{t('nfc.name')}</label>
                                <input className="login-input" value={form.full_name}
                                    onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label>{t('nfc.phone')}</label>
                                <input className="login-input" value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label>{t('nfc.quantity')}</label>
                                <input type="number" min="1" max="1000" className="login-input" value={form.quantity}
                                    onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label>{t('nfc.note')}</label>
                                <textarea className="login-input" rows="3" value={form.note}
                                    onChange={(e) => setForm({ ...form, note: e.target.value })} />
                            </div>
                            <button type="submit" className="login-btn" disabled={busy}>
                                {busy ? t('nfc.sending') : t('nfc.submit')}
                            </button>
                        </form>
                        <p className="nfc-disclaimer">{t('nfc.no_payment')}</p>
                    </div>

                    {orders.length > 0 && (
                        <div className="nfc-history">
                            <h3>{t('nfc.history')}</h3>
                            {orders.map((o) => {
                                const c = STATUS_COLOR[o.status] || STATUS_COLOR.new;
                                return (
                                    <div key={o.id} className="nfc-order-row">
                                        <div>
                                            <strong>×{o.quantity}</strong> — {o.full_name}
                                            <span className="nfc-order-date">{new Date(o.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <span className="nfc-status" style={{ background: c.bg, color: c.fg }}>
                                            {o.status_display}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Nfc;
