import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaLink } from 'react-icons/fa';

// Format phone number with spaces: +998 94 351 19 10
// User input starts after +998, we only format the remaining 9 digits
const formatPhoneNumber = (value, hasPrefix = true) => {
    // Remove all non-numeric
    const cleaned = value.replace(/[^\d]/g, '');

    // If has prefix, we expect input like "94 351 19 10" (9 digits)
    // Format: XX XXX XX XX
    let formatted = '';
    for (let i = 0; i < cleaned.length && i < 9; i++) {
        if (i === 2) formatted += ' ';
        else if (i === 5) formatted += ' ';
        else if (i === 7) formatted += ' ';
        formatted += cleaned[i];
    }

    return formatted;
};

// Get raw phone number for API (+998 + user input without spaces)
const getRawPhone = (userInput) => {
    const cleaned = userInput.replace(/\s/g, '');
    return '+998' + cleaned;
};

const Login = () => {
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setPhone(formatted);
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('auth/otp/', { phone_number: getRawPhone(phone) });
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.phone_number || 'OTP yuborishda xatolik');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('auth/login/', { phone_number: getRawPhone(phone), code });
            localStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            setError('Kod noto\'g\'ri');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Left Side - Image */}
            <div className="login-left">
                <img src="/login-bg.png" alt="MyLink" className="login-bg-image" />
            </div>

            {/* Right Side - Form */}
            <div className="login-right">
                <div className="login-form-container">
                    <div className="login-header">
                        <h2>{step === 1 ? 'Kirish' : 'Tasdiqlash'}</h2>
                        <p>{step === 1 ? 'Telefon raqamingizni kiriting' : `${phone} ga kod yuborildi`}</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    {step === 1 ? (
                        <form onSubmit={handleSendOTP} className="login-form">
                            <div className="input-group">
                                <label>Telefon raqam</label>
                                <div className="phone-input-group">
                                    <span className="phone-prefix">+998</span>
                                    <input
                                        type="tel"
                                        className="login-input phone-input"
                                        placeholder="90 123 45 67"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="login-btn" disabled={loading}>
                                {loading ? 'Yuborilmoqda...' : (
                                    <>Davom etish <FaArrowRight /></>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOTP} className="login-form">
                            <div className="input-group">
                                <label>Tasdiqlash kodi</label>
                                <input
                                    type="text"
                                    className="login-input code-input"
                                    placeholder="• • • • •"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    maxLength={5}
                                    required
                                />
                            </div>
                            <button type="submit" className="login-btn" disabled={loading}>
                                {loading ? 'Tekshirilmoqda...' : 'Kirish'}
                            </button>
                            <button
                                type="button"
                                className="login-back-btn"
                                onClick={() => { setStep(1); setError(''); }}
                            >
                                ← Raqamni o'zgartirish
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
