import React, { useState } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import GoogleButton from '../components/GoogleButton';
import PasswordInput from '../components/PasswordInput';

const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/[^\d]/g, '');
    let formatted = '';
    for (let i = 0; i < cleaned.length && i < 9; i++) {
        if (i === 2 || i === 5 || i === 7) formatted += ' ';
        formatted += cleaned[i];
    }
    return formatted;
};
const getRawPhone = (v) => '+998' + v.replace(/\s/g, '');

const tabBtn = (active) => ({
    flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 600,
    background: active ? '#4f46e5' : 'transparent', color: active ? '#fff' : '#6b7280',
    borderRadius: 8, transition: 'all 0.15s',
});

const Divider = ({ label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: '#9ca3af', fontSize: 13 }}>
        <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} /> {label} <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
    </div>
);

const Login = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tab, setTab] = useState('email'); // 'email' | 'phone'
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const identifier = tab === 'email' ? email.trim() : getRawPhone(phone);
        try {
            const res = await api.post('auth/login-password/', { identifier, password });
            localStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-left">
                <img src="/login-bg.png" alt="MyLink" className="login-bg-image" />
            </div>
            <div className="login-right">
                <div style={{ position: 'absolute', top: 20, right: 20 }}>
                    <LanguageSwitcher />
                </div>
                <div className="login-form-container">
                    <div className="login-header">
                        <h2>{t('login.title_phone')}</h2>
                    </div>

                    {/* Email / Phone tabs */}
                    <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                        <button type="button" style={tabBtn(tab === 'email')} onClick={() => { setTab('email'); setError(''); }}>{t('auth.tab_email')}</button>
                        <button type="button" style={tabBtn(tab === 'phone')} onClick={() => { setTab('phone'); setError(''); }}>{t('auth.tab_phone')}</button>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <form onSubmit={submit} className="login-form">
                        {tab === 'email' ? (
                            <div className="input-group">
                                <label>{t('auth.email_label')}</label>
                                <input type="email" className="login-input" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>
                        ) : (
                            <div className="input-group">
                                <label>{t('login.phone_label')}</label>
                                <div className="phone-input-group">
                                    <span className="phone-prefix">+998</span>
                                    <input type="tel" className="login-input phone-input" placeholder="90 123 45 67" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} required />
                                </div>
                            </div>
                        )}
                        <div className="input-group">
                            <label>{t('auth.password_label')}</label>
                            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? t('login.verifying') : t('auth.login')}
                        </button>
                        {tab === 'email' && (
                            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 14 }}>
                                <Link to="/forgot-password">{t('auth.forgot')}</Link>
                            </div>
                        )}
                    </form>

                    <Divider label={t('auth.or')} />
                    <GoogleButton onError={(msg) => setError(msg || t('common.error'))} />

                    <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6b7280' }}>
                        {t('auth.no_account')} <Link to="/register">{t('auth.register')}</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
