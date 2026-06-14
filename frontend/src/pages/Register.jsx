import React, { useState } from 'react';
import api from '../api';
import { useEntitlements } from '../context/EntitlementContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/AuthLayout';
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

const Register = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { refresh: refreshEntitlements } = useEntitlements();
    const [searchParams] = useSearchParams();
    const ref = searchParams.get('ref') || '';

    const [tab, setTab] = useState('email'); // 'email' | 'phone'
    const [step, setStep] = useState(1);      // 1 = identifier, 2 = code + name + password
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const identifier = tab === 'email' ? email.trim().toLowerCase() : getRawPhone(phone);

    const sendCode = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // mode=register → backend rejects an already-registered email/phone
            // BEFORE sending a code (no "code arrived, but you already exist").
            if (tab === 'email') await api.post('auth/email/otp/', { email: email.trim(), mode: 'register' });
            else await api.post('auth/otp/', { phone_number: getRawPhone(phone), mode: 'register' });
            setStep(2);
        } catch (err) {
            const d = err.response?.data;
            setError(d?.error || d?.email?.[0] || d?.phone_number?.[0] || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const finishRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('auth/register/', { method: tab, identifier, code, password, full_name: fullName.trim(), ref });
            localStorage.setItem('token', res.data.token);
            refreshEntitlements(); // navbar name + tier badge
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title={step === 1 ? t('auth.register_title') : t('auth.verify_title')}
            subtitle={step === 1 ? t('auth.register_subtitle') : undefined}
        >
            {step === 1 && (
                <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                    <button type="button" style={tabBtn(tab === 'email')} onClick={() => { setTab('email'); setError(''); }}>{t('auth.tab_email')}</button>
                    <button type="button" style={tabBtn(tab === 'phone')} onClick={() => { setTab('phone'); setError(''); }}>{t('auth.tab_phone')}</button>
                </div>
            )}

            {error && <div className="login-error">{error}</div>}

            {step === 1 ? (
                <>
                    <form onSubmit={sendCode} className="login-form">
                        {tab === 'email' ? (
                            <div className="input-group">
                                <label>{t('auth.email_label')}</label>
                                <input type="email" name="email" autoComplete="email" className="login-input" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>
                        ) : (
                            <div className="input-group">
                                <label>{t('login.phone_label')}</label>
                                <div className="phone-input-group">
                                    <span className="phone-prefix">+998</span>
                                    <input type="tel" name="phone" autoComplete="tel-national" className="login-input phone-input" placeholder="90 123 45 67" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} required />
                                </div>
                            </div>
                        )}
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? t('login.sending') : t('auth.send_code')}
                        </button>
                    </form>

                    <Divider label={t('auth.or')} />
                    <GoogleButton onError={(msg) => setError(msg || t('common.error'))} />
                </>
            ) : (
                // autoComplete="off" on the form + one-time-code / new-password on the
                // inputs keeps the browser from autofilling saved login credentials here.
                <form onSubmit={finishRegister} className="login-form" autoComplete="off">
                    <div className="input-group">
                        <label>{t('login.code_label')}</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="otp"
                            autoComplete="one-time-code"
                            className="login-input"
                            placeholder="• • • • • •"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>{t('auth.full_name')}</label>
                        <input
                            type="text"
                            name="full_name"
                            autoComplete="name"
                            className="login-input"
                            placeholder={t('auth.full_name_ph')}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>{t('auth.create_password')}</label>
                        <PasswordInput name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? t('login.sending') : t('auth.register')}
                    </button>
                    <button type="button" className="login-back-btn" onClick={() => { setStep(1); setError(''); }}>
                        ← {t('login.change_number')}
                    </button>
                </form>
            )}

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6b7280' }}>
                {t('auth.have_account')} <Link to="/login">{t('auth.login')}</Link>
            </div>
        </AuthLayout>
    );
};

export default Register;
