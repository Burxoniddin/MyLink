import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import LinkButton from '../components/LinkButton';
import { FaLink } from 'react-icons/fa';

// Backend base URL for media files
const MEDIA_BASE_URL = 'http://127.0.0.1:8000';

const LandingPage = () => {
    const { path } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`public/${path}/`);
                setData(res.data);
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [path]);

    // Helper function to get full logo URL
    const getLogoUrl = (logo) => {
        if (!logo) return null;
        // If logo already has http/https, return as is
        if (logo.startsWith('http://') || logo.startsWith('https://')) {
            return logo;
        }
        // Otherwise, prepend backend base URL
        return `${MEDIA_BASE_URL}${logo}`;
    };

    if (loading) {
        return (
            <div className="landing-page">
                <div className="landing-loading">
                    <div className="landing-spinner"></div>
                    <p>Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="landing-page">
                <div className="landing-error">
                    <div className="error-icon">🔍</div>
                    <h2>Sahifa topilmadi</h2>
                    <p>Siz qidirgan sahifa mavjud emas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="landing-page">
            {/* Animated background */}
            <div className="landing-bg-gradient"></div>

            {/* Main content card */}
            <div className="landing-card fade-in-up">
                {/* Profile section */}
                <div className="landing-profile">
                    {/* Only show logo if it exists */}
                    {data.logo && (
                        <div className="landing-avatar-wrapper">
                            <img
                                src={getLogoUrl(data.logo)}
                                alt={data.name}
                                className="landing-avatar"
                            />
                            <div className="landing-avatar-ring"></div>
                        </div>
                    )}

                    <h1 className="landing-title">{data.name}</h1>

                    {data.description && (
                        <p className="landing-bio">{data.description}</p>
                    )}
                </div>

                {/* Links section */}
                <div className="landing-links">
                    {data.links && data.links.map((link, index) => (
                        <LinkButton key={link.id} link={link} index={index} />
                    ))}
                </div>

                {/* Empty state */}
                {(!data.links || data.links.length === 0) && (
                    <div className="landing-empty">
                        <div className="empty-icon">🔗</div>
                        <p>Hali havolalar qo'shilmagan</p>
                    </div>
                )}

                {/* Footer */}
                <div className="landing-branding">
                    <img src="/logo.png" alt="MyLink" className="landing-brand-logo" />
                    <span>Powered by</span>
                    <a href="/" target="_blank" rel="noopener noreferrer">MyLink</a>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
