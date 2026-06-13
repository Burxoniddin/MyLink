import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PasswordInput from '../components/PasswordInput';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';

const cardStyle = {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: 20,
};

const Profile = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const toast = useToast();
    const { refresh: refreshEntitlements } = useEntitlements();

    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoBusy, setPromoBusy] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        load();
    }, []);

    const load = async () => {
        try {
            const res = await api.get('me/');
            setMe(res.data);
            setFullName(res.data.full_name || '');
        } catch (err) {
            if (err.response?.status === 401) navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const saveName = async (e) => {
        e.preventDefault();
        try {
            await api.patch('me/', { full_name: fullName });
            toast.success(t('auth.name_saved'));
            await refreshEntitlements(); // navbar shows the new name
            load();
        } catch {
            toast.error(t('common.error'));
        }
    };

    const savePassword = async (e) => {
        e.preventDefault();
        try {
            if (me.has_password) {
                await api.post('auth/change-password/', { old_password: oldPassword, new_password: newPassword });
            } else {
                await api.post('auth/set-password/', { password: newPassword });
            }
            toast.success(t('auth.password_saved'));
            setOldPassword('');
            setNewPassword('');
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || t('common.error'));
        }
    };

    const redeemPromo = async (e) => {
        e.preventDefault();
        setPromoBusy(true);
        try {
            await api.post('promo/redeem/', { code: promoCode });
            toast.success(t('promo.success'));
            setPromoCode('');
            await refreshEntitlements();
            load();
        } catch (err) {
            const reason = err.response?.data?.reason;
            const key = reason ? `promo.err_${reason}` : 'common.error';
            const text = t(key);
            toast.error(text === key ? t('common.error') : text);
        } finally {
            setPromoBusy(false);
        }
    };

    const saveEmail = async (e) => {
        e.preventDefault();
        try {
            await api.post('auth/add-email/', { email });
            toast.success(t('auth.email_added'));
            setEmail('');
            load();
        } catch (err) {
            toast.error(err.response?.data?.email?.[0] || t('common.error'));
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner"></div><p>{t('common.loading')}</p></div>;
    }

    const tier = me.entitlements?.tier || 'free';
    const TIER_BADGES = {
        free: { bg: '#f3f4f6', fg: '#374151' },
        oddiy: { bg: '#dbeafe', fg: '#1e40af' },
        pro: { bg: '#fef3c7', fg: '#92400e' },
    };
    const tierBadge = TIER_BADGES[tier] || TIER_BADGES.free;
    const expiresAt = me.entitlements?.expires_at;
    let planExpiryLabel = '';
    if (tier !== 'free') {
        planExpiryLabel = expiresAt
            ? t('promo.until', { date: new Date(expiresAt).toLocaleDateString() })
            : t('promo.lifetime');
    }

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container" style={{ maxWidth: 640 }}>
                    <h1 style={{ marginBottom: 24 }}>{me.full_name || t('auth.profile_title')}</h1>

                    {/* Account info + name */}
                    <div style={cardStyle}>
                        <form onSubmit={saveName} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: '#6b7280', fontSize: 14, marginBottom: 6 }}>{t('auth.full_name')}</label>
                                <input
                                    className="login-input"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder={t('auth.full_name_ph')}
                                    autoComplete="name"
                                />
                            </div>
                            <button type="submit" className="login-btn" style={{ width: 'auto', whiteSpace: 'nowrap', padding: '14px 18px' }}>
                                {t('common.save')}
                            </button>
                        </form>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                            <span style={{ color: '#6b7280' }}>{t('login.phone_label')}</span>
                            <strong>{me.phone_number || '—'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                            <span style={{ color: '#6b7280' }}>{t('auth.email_label')}</span>
                            <strong>{me.email || '—'}</strong>
                        </div>
                    </div>

                    {/* Current plan + promo */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ color: '#6b7280' }}>{t('promo.current_plan')}</span>
                            <span style={{
                                fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                                background: tierBadge.bg, color: tierBadge.fg, fontSize: 14,
                            }}>{t(`promo.tier_${tier}`)}{planExpiryLabel ? ` · ${planExpiryLabel}` : ''}</span>
                        </div>
                        <h3 style={{ margin: '0 0 4px' }}>{t('promo.title')}</h3>
                        <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 14 }}>{t('promo.desc')}</p>
                        <form onSubmit={redeemPromo} style={{ display: 'flex', gap: 8 }}>
                            <input
                                className="login-input"
                                style={{ flex: 1, textTransform: 'uppercase' }}
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                placeholder={t('promo.placeholder')}
                                required
                            />
                            <button type="submit" className="login-btn" style={{ width: 'auto', whiteSpace: 'nowrap' }} disabled={promoBusy}>
                                {promoBusy ? t('promo.redeeming') : t('promo.redeem')}
                            </button>
                        </form>
                    </div>

                    {/* Password */}
                    <div style={cardStyle}>
                        <h3 style={{ marginTop: 0 }}>{me.has_password ? t('auth.change_password') : t('auth.set_password')}</h3>
                        <form onSubmit={savePassword}>
                            {me.has_password && (
                                <div className="input-group">
                                    <label>{t('auth.old_password')}</label>
                                    <PasswordInput value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                                </div>
                            )}
                            <div className="input-group">
                                <label>{t('auth.new_password')}</label>
                                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
                            </div>
                            <button type="submit" className="login-btn" style={{ marginTop: 8 }}>{t('common.save')}</button>
                        </form>
                    </div>

                    {/* Add email if missing */}
                    {!me.email && (
                        <div style={cardStyle}>
                            <h3 style={{ marginTop: 0 }}>{t('auth.add_email')}</h3>
                            <form onSubmit={saveEmail}>
                                <div className="input-group">
                                    <label>{t('auth.email_label')}</label>
                                    <input type="email" className="login-input" value={email}
                                        onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                                <button type="submit" className="login-btn" style={{ marginTop: 8 }}>{t('common.save')}</button>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Profile;
