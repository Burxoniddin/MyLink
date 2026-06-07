import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PasswordInput from '../components/PasswordInput';

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

    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });

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
        } catch (err) {
            if (err.response?.status === 401) navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const savePassword = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            if (me.has_password) {
                await api.post('auth/change-password/', { old_password: oldPassword, new_password: newPassword });
            } else {
                await api.post('auth/set-password/', { password: newPassword });
            }
            setMsg({ type: 'success', text: t('auth.password_saved') });
            setOldPassword('');
            setNewPassword('');
            load();
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || t('common.error') });
        }
    };

    const saveEmail = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            await api.post('auth/add-email/', { email });
            setMsg({ type: 'success', text: t('auth.email_added') });
            setEmail('');
            load();
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.email?.[0] || t('common.error') });
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner"></div><p>{t('common.loading')}</p></div>;
    }

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container" style={{ maxWidth: 640 }}>
                    <h1 style={{ marginBottom: 24 }}>{t('auth.profile_title')}</h1>

                    {msg.text && (
                        <div className={`message ${msg.type}`} style={{
                            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                            background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
                            color: msg.type === 'success' ? '#166534' : '#991b1b',
                        }}>{msg.text}</div>
                    )}

                    {/* Account info */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                            <span style={{ color: '#6b7280' }}>{t('login.phone_label')}</span>
                            <strong>{me.phone_number || '—'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                            <span style={{ color: '#6b7280' }}>{t('auth.email_label')}</span>
                            <strong>{me.email || '—'}</strong>
                        </div>
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
