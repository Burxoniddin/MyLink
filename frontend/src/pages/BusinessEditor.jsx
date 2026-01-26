import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../api';
import { FaTelegram, FaInstagram, FaFacebook, FaWhatsapp, FaPhone, FaGlobe, FaTimes, FaPlus, FaSave, FaLink, FaLinkedin } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";

const PLATFORM_OPTIONS = [
    { value: 'telegram', label: 'Telegram' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'x', label: 'X (Twitter)' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'phone', label: 'Telefon' },
    { value: 'yandex_map', label: 'Yandex Map' },
    { value: 'google_map', label: 'Google Map' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'website', label: 'Website' },
];

const BusinessEditor = () => {
    const { business, fetchBusiness } = useOutletContext();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        path: '',
        name: '',
        description: '',
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (business) {
            setFormData({
                path: business.path || '',
                name: business.name || '',
                description: business.description || '',
            });
            setLogoPreview(business.logo);
            setLinks(business.links || []);
        }
    }, [business]);

    const handleLinkChange = (index, field, value) => {
        const newLinks = [...links];
        newLinks[index][field] = value;
        setLinks(newLinks);
    };

    const addLink = () => {
        setLinks([...links, { title: '', url: '', icon_type: 'website', order: links.length }]);
    };

    const removeLink = (index) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                ...formData,
                links: links.map((l, i) => ({ ...l, order: i }))
            };

            let res;
            if (business) {
                res = await api.put(`businesses/${business.path}/`, payload);
            } else {
                res = await api.post(`businesses/`, payload);
            }

            const newPath = res.data.path;

            if (logoFile) {
                const logoData = new FormData();
                logoData.append('logo', logoFile);
                await api.patch(`businesses/${newPath}/`, logoData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setSuccess('Saqlandi!');
            fetchBusiness();

            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error(err);
            if (err.response?.data?.path) {
                setError('Bu path band. Boshqasini tanlang.');
            } else {
                setError('Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="editor-container">
            <div className="editor-section">
                <h3 className="editor-section-title">Asosiy ma'lumotlar</h3>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <div className="form-group">
                    <label>Path</label>
                    <div className="input-with-prefix">
                        <span className="input-prefix">mylink.asia/</span>
                        <input
                            className="input-field"
                            value={formData.path}
                            onChange={e => setFormData({ ...formData, path: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                            placeholder="mybrand"
                            disabled={!!business}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Biznes nomi</label>
                    <input
                        className="input-field"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Shop"
                    />
                </div>

                <div className="form-group">
                    <label>Tavsif</label>
                    <textarea
                        className="input-field"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Biznesingiz haqida qisqacha..."
                        rows={3}
                    />
                </div>

                <div className="form-group">
                    <label>Logo</label>
                    <div className="logo-upload">
                        {(logoPreview || logoFile) && (
                            <img
                                src={logoFile ? URL.createObjectURL(logoFile) : logoPreview}
                                alt="Logo"
                                className="logo-preview"
                            />
                        )}
                        <label className="upload-btn">
                            {logoPreview || logoFile ? 'O\'zgartirish' : 'Yuklash'}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => setLogoFile(e.target.files[0])}
                                hidden
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Links Section */}
            <div className="editor-section">
                <div className="section-header">
                    <h3 className="editor-section-title">Linklar</h3>
                    <button className="add-link-btn" onClick={addLink}>
                        <FaPlus size={12} /> Qo'shish
                    </button>
                </div>

                {links.length === 0 && (
                    <div className="empty-links">
                        <FaLink />
                        <p>Hali linklar yo'q</p>
                    </div>
                )}

                {links.map((link, i) => (
                    <div key={i} className="link-card">
                        <div className="link-card-header">
                            <span>Link #{i + 1}</span>
                            <button className="remove-btn" onClick={() => removeLink(i)}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Platforma</label>
                                <select
                                    className="input-field"
                                    value={link.icon_type}
                                    onChange={e => handleLinkChange(i, 'icon_type', e.target.value)}
                                >
                                    {PLATFORM_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Nom</label>
                            <input
                                className="input-field"
                                placeholder="Masalan: Telegram kanal"
                                value={link.title}
                                onChange={e => handleLinkChange(i, 'title', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>URL</label>
                            <input
                                className="input-field"
                                placeholder="https://..."
                                value={link.url}
                                onChange={e => handleLinkChange(i, 'url', e.target.value)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Save Button */}
            <button
                className="save-btn"
                onClick={handleSave}
                disabled={loading}
            >
                {loading ? 'Saqlanmoqda...' : (
                    <>
                        <FaSave /> Saqlash
                    </>
                )}
            </button>
        </div>
    );
};

export default BusinessEditor;
