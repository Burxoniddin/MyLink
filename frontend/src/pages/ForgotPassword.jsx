import React, { useState } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
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

const ForgotPassword = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [tab, setTab] = useState('email'); // 'email' | 'phone'
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const identifier = tab === 'email' ? email.trim().toLowerCase() : getRawPhone(phone);

    const sendCode = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (tab === 'email') await api.post('auth/email/otp/', { email: email.trim() });
            else await api.post('auth/otp/', { phone_number: getRawPhone(phone) });
            setStep(2);
        } catch (err) {
            const d = err.response?.data;
            setError(d?.error || d?.email?.[0] || d?.phone_number?.[0] || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const resetAndLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('auth/reset-password-code/', { method: tab, identifier, code, new_password: password });
            localStorage.setItem('token', res.data.token);
            navigate('/dashboard'); // auto-login after reset
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
                        <h2>{step === 1 ? t('auth.forgot_title') : t('auth.verify_title')}</h2>
                        {step === 1 && <p>{t('auth.forgot_desc')}</p>}
                    </div>

                    {step === 1 && (
                        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                            <button type="button" style={tabBtn(tab === 'email')} onClick={() => { setTab('email'); setError(''); }}>{t('auth.tab_email')}</button>
                            <button type="button" style={tabBtn(tab === 'phone')} onClick={() => { setTab('phone'); setError(''); }}>{t('auth.tab_phone')}</button>
                        </div>
                    )}

                    {error && <div className="login-error">{error}</div>}

                    {step === 1 ? (
                        <form onSubmit={sendCode} className="login-form">
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
                            <button type="submit" className="login-btn" disabled={loading}>
                                {loading ? t('login.sending') : t('auth.send_code')}
                            </button>
                            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 14 }}>
                                <Link to="/login">{t('auth.back_to_login')}</Link>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={resetAndLogin} className="login-form">
                            <div className="input-group">
                                <label>{t('login.code_label')}</label>
                                <input type="text" className="login-input" placeholder="• • • • • •" value={code} onChange={(e) => setCode(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>{t('auth.new_password')}</label>
                                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                            </div>
                            <button type="submit" className="login-btn" disabled={loading}>
                                {loading ? t('login.sending') : t('auth.reset_btn')}
                            </button>
                            <button type="button" className="login-back-btn" onClick={() => { setStep(1); setError(''); }}>
                                ← {t('login.change_number')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
