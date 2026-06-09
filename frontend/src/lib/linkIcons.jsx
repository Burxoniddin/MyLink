// Shared link icon + brand colour lookup used by the public templates.
// Mirrors the platform mapping in components/LinkButton.jsx.
import { FaTelegram, FaInstagram, FaFacebook, FaWhatsapp, FaPhone, FaGlobe, FaLinkedin, FaYoutube, FaEnvelope, FaTiktok, FaYandex, FaMapMarkedAlt } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

const MAP = {
    telegram:        { Icon: FaTelegram,     color: '#2AABEE' },
    telegram_number: { Icon: FaTelegram,     color: '#2AABEE' },
    instagram:       { Icon: FaInstagram,    color: '#E1306C' },
    facebook:        { Icon: FaFacebook,     color: '#1877F2' },
    tiktok:          { Icon: FaTiktok,       color: '#FE2C55' },
    x:               { Icon: FaXTwitter,     color: '#1DA1F2' },
    whatsapp:        { Icon: FaWhatsapp,     color: '#25D366' },
    phone:           { Icon: FaPhone,        color: '#34C759' },
    linkedin:        { Icon: FaLinkedin,     color: '#0A66C2' },
    youtube:         { Icon: FaYoutube,      color: '#FF0000' },
    gmail:           { Icon: FaEnvelope,     color: '#EA4335' },
    yandex_map:      { Icon: FaYandex,       color: '#FC3F1D' },
    google_map:      { Icon: FaMapMarkedAlt, color: '#4285F4' },
    website:         { Icon: FaGlobe,        color: '#6366f1' },
    other:           { Icon: FaGlobe,        color: '#6366f1' },
};

const FALLBACK = { Icon: FaGlobe, color: '#6366f1' };

export const getLinkIcon = (iconType) => {
    const { Icon } = MAP[iconType] || FALLBACK;
    return <Icon />;
};

export const getBrandColor = (iconType) => (MAP[iconType] || FALLBACK).color;
