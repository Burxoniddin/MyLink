import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Renders the Google sign-in button. No-op (hidden) until VITE_GOOGLE_CLIENT_ID
// is configured and the provider is mounted in main.jsx.
const GoogleButton = ({ onError }) => {
    const navigate = useNavigate();
    if (!CLIENT_ID) return null;

    const handleSuccess = async (resp) => {
        try {
            const res = await api.post('auth/google/', { credential: resp.credential });
            localStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            if (onError) onError(err.response?.data?.error);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin onSuccess={handleSuccess} onError={() => onError && onError()} width="320" />
        </div>
    );
};

export default GoogleButton;
