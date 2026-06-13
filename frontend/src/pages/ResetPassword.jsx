import React, { useState } from 'react';
import api from '../api';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';

const ResetPassword = () => {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const uid = params.get('uid') || '';
    const token = params.get('token') || '';

    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('auth/reset-password/', { uid, token, new_password: password });
            setDone(true);
        } catch (err) {
            setError(err.response?.data?.error || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title={t('auth.reset_title')}>
            {error && <div className="login-error">{error}</div>}

            {done ? (
                <div>
                    <div className="login-error" style={{ background: '#dcfce7', color: '#166534' }}>
                        {t('auth.reset_done')}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <Link to="/login">{t('auth.back_to_login')}</Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={submit} className="login-form" autoComplete="off">
                    <div className="input-group">
                        <label>{t('auth.new_password')}</label>
                        <PasswordInput name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading || !uid || !token}>
                        {loading ? t('login.sending') : t('auth.reset_btn')}
                    </button>
                </form>
            )}
        </AuthLayout>
    );
};

export default ResetPassword;
