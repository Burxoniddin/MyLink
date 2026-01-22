import React from 'react';
import { FaTelegram, FaInstagram, FaFacebook, FaWhatsapp, FaPhone, FaGlobe, FaLinkedin, FaLink } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";

const getIconAndColor = (iconType) => {
    switch (iconType) {
        case 'telegram':
            return {
                icon: <FaTelegram />,
                gradient: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
                shadow: 'rgba(42, 171, 238, 0.4)'
            };
        case 'instagram':
            return {
                icon: <FaInstagram />,
                gradient: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
                shadow: 'rgba(221, 42, 123, 0.4)'
            };
        case 'facebook':
            return {
                icon: <FaFacebook />,
                gradient: 'linear-gradient(135deg, #1877F2 0%, #0D65D9 100%)',
                shadow: 'rgba(24, 119, 242, 0.4)'
            };
        case 'x':
            return {
                icon: <FaXTwitter />,
                gradient: 'linear-gradient(135deg, #14171A 0%, #657786 100%)',
                shadow: 'rgba(20, 23, 26, 0.4)'
            };
        case 'whatsapp':
            return {
                icon: <FaWhatsapp />,
                gradient: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                shadow: 'rgba(37, 211, 102, 0.4)'
            };
        case 'phone':
            return {
                icon: <FaPhone />,
                gradient: 'linear-gradient(135deg, #34C759 0%, #30B350 100%)',
                shadow: 'rgba(52, 199, 89, 0.4)'
            };
        case 'linkedin':
            return {
                icon: <FaLinkedin />,
                gradient: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                shadow: 'rgba(10, 102, 194, 0.4)'
            };
        case 'website':
        default:
            return {
                icon: <FaGlobe />,
                gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                shadow: 'rgba(99, 102, 241, 0.4)'
            };
    }
};

const LinkButton = ({ link, index = 0 }) => {
    const { icon, gradient, shadow } = getIconAndColor(link.icon_type);

    return (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="premium-link-btn"
            style={{
                background: gradient,
                '--btn-shadow': shadow,
                animationDelay: `${index * 0.1}s`
            }}
        >
            <div className="link-btn-icon">
                {icon}
            </div>
            <span className="link-btn-text">{link.title}</span>
            <div className="link-btn-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </div>
        </a>
    );
};

export default LinkButton;
