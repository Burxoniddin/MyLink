import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { FaLink, FaArrowLeft, FaEye, FaEdit, FaPalette, FaCog, FaStar, FaPlus, FaTimes, FaSave, FaBars, FaTelegram, FaInstagram, FaFacebook, FaWhatsapp, FaPhone, FaGlobe, FaLinkedin, FaCloudUploadAlt, FaExternalLinkAlt, FaCheck, FaTrash, FaYoutube, FaEnvelope, FaGripLines, FaTiktok, FaYandex, FaMapMarkedAlt } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import LinkButton from '../components/LinkButton';

// Drag & Drop
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component
const SortableLinkItem = ({ id, link, index, updateLink, removeLink, getPlatformIcon, detectPlatform }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="link-item">
            {/* Drag Handle */}
            <div className="drag-handle" {...attributes} {...listeners}>
                <FaGripLines />
            </div>

            <div className="link-icon-auto">
                {getPlatformIcon(detectPlatform(link.url))}
            </div>
            <div className="link-fields">
                <input
                    placeholder="Link nomi"
                    value={link.title}
                    onChange={e => updateLink(index, 'title', e.target.value)}
                />
                <input
                    placeholder="t.me/... yoki instagram.com/..."
                    value={link.url}
                    onChange={e => updateLink(index, 'url', e.target.value)}
                />
            </div>
            <button className="remove-link" onClick={() => removeLink(index)}>
                <FaTimes />
            </button>
        </div>
    );
};

// Auto-detect platform from URL
const detectPlatform = (url) => {
    if (!url) return 'website';
    const lower = url.toLowerCase();
    if (lower.includes('t.me') || lower.includes('telegram')) return 'telegram';
    if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
    if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.me')) return 'facebook';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x';
    if (lower.includes('wa.me') || lower.includes('whatsapp')) return 'whatsapp';
    if (lower.includes('linkedin.com')) return 'linkedin';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('gmail.com') || lower.includes('mail.google.com')) return 'gmail';
    if (lower.includes('tel:') || /^\+?\d{9,}$/.test(url.replace(/\s/g, ''))) return 'phone';
    // TikTok detection
    if (lower.includes('tiktok.com') || lower.includes('vm.tiktok.com')) return 'tiktok';
    // Yandex Maps detection
    if (lower.includes('yandex.') && (lower.includes('/maps') || lower.includes('maps.'))) return 'yandex_map';
    // Google Maps detection
    if (lower.includes('google.') && lower.includes('maps')) return 'google_map';
    if (lower.includes('goo.gl/maps') || lower.includes('maps.app.goo.gl')) return 'google_map';
    return 'website';
};

// Normalize URL - add https:// if missing
const normalizeUrl = (url) => {
    if (!url) return url;
    const trimmed = url.trim();
    // Skip if it's a phone number or tel: link
    if (trimmed.startsWith('tel:') || /^\+?\d{9,}$/.test(trimmed.replace(/\s/g, ''))) {
        return trimmed.startsWith('tel:') ? trimmed : `tel:${trimmed}`;
    }
    // Add https:// if no protocol
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

const getPlatformIcon = (type) => {
    switch (type) {
        case 'telegram': return <FaTelegram />;
        case 'instagram': return <FaInstagram />;
        case 'facebook': return <FaFacebook />;
        case 'x': return <FaXTwitter />;
        case 'whatsapp': return <FaWhatsapp />;
        case 'linkedin': return <FaLinkedin />;
        case 'youtube': return <FaYoutube />;
        case 'gmail': return <FaEnvelope />;
        case 'phone': return <FaPhone />;
        case 'tiktok': return <FaTiktok />;
        case 'yandex_map': return <FaYandex />;
        case 'google_map': return <FaMapMarkedAlt />;
        default: return <FaGlobe />;
    }
};

// Sample data for new business preview
const SAMPLE_DATA = {
    name: 'Mening biznesim',
    description: 'Bu yerda biznesingiz tavsifi bo\'ladi',
    links: [
        { title: 'Telegram kanal', url: 'https://t.me/example', icon_type: 'telegram' },
        { title: 'Instagram sahifa', url: 'https://instagram.com/example', icon_type: 'instagram' },
    ]
};

const BusinessDetail = ({ isNew = false }) => {
    const { path } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('edit');
    const [business, setBusiness] = useState(null);
    const [formData, setFormData] = useState({ path: '', name: '', description: '' });
    const [links, setLinks] = useState([]);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [logoRemoved, setLogoRemoved] = useState(false);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Path availability check
    const [pathStatus, setPathStatus] = useState(null); // null, 'available', 'taken', 'checking'
    const pathCheckTimeout = useRef(null);

    // Drag and drop for Logo
    const [isDraggingLogo, setIsDraggingLogo] = useState(false);
    const dropZoneRef = useRef(null);

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (!isNew && path) {
            fetchBusiness();
        }
    }, [path, isNew]);

    // Check path availability
    const checkPathAvailability = useCallback(async (pathToCheck) => {
        if (!pathToCheck || pathToCheck.length < 2) {
            setPathStatus(null);
            return;
        }

        setPathStatus('checking');
        try {
            await api.get(`businesses/${pathToCheck}/`);
            setPathStatus('taken');
        } catch (err) {
            if (err.response?.status === 404) {
                setPathStatus('available');
            } else {
                setPathStatus(null);
            }
        }
    }, []);

    const handlePathChange = (e) => {
        // Updated Regex: Allow lowercase letters, numbers, hyphens, and UNDERSCORES
        const newPath = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        setFormData({ ...formData, path: newPath });

        // Debounce path check
        if (pathCheckTimeout.current) {
            clearTimeout(pathCheckTimeout.current);
        }
        pathCheckTimeout.current = setTimeout(() => {
            checkPathAvailability(newPath);
        }, 500);
    };

    const fetchBusiness = async () => {
        try {
            const res = await api.get(`businesses/${path}/`);
            setBusiness(res.data);
            setFormData({ path: res.data.path, name: res.data.name, description: res.data.description || '' });

            // Generate IDs for existing links to make them sortable
            const linksWithIds = (res.data.links || []).map((link, idx) => ({
                ...link,
                id: link.id || `temp-${Date.now()}-${idx}` // Use existing ID or temporary ID
            }));
            setLinks(linksWithIds);

            setLogoPreview(res.data.logo);
            setLogoRemoved(false);
        } catch (err) {
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            // Normalize URLs and auto-detect platform, filter out empty URLs
            const processedLinks = links
                .filter(l => l.url && l.url.trim() !== '')
                .map((l, i) => ({
                    ...l,
                    url: normalizeUrl(l.url),
                    icon_type: detectPlatform(normalizeUrl(l.url)),
                    order: i
                    // remove temporary ID before sending
                }));

            const payload = { ...formData, links: processedLinks };
            let res;
            if (isNew) {
                res = await api.post('businesses/', payload);
            } else {
                res = await api.put(`businesses/${path}/`, payload);
            }

            // Logo o'chirilgan bo'lsa, backendga xabar berish
            if (logoRemoved && !logoFile) {
                await api.patch(`businesses/${res.data.path}/`, { logo_remove: true });
            } else if (logoFile) {
                // Yangi logo yuklangan bo'lsa
                const logoData = new FormData();
                logoData.append('logo_upload', logoFile);
                await api.patch(`businesses/${res.data.path}/`, logoData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setMessage({ type: 'success', text: 'Saqlandi!' });

            // Redirect to preview after save
            if (isNew) {
                navigate(`/business/${res.data.path}`);
            } else {
                await fetchBusiness();
            }
            setActiveTab('preview');
        } catch (err) {
            if (err.response?.data?.path) {
                setMessage({ type: 'error', text: 'Bu path band' });
            } else {
                setMessage({ type: 'error', text: 'Xatolik yuz berdi' });
            }
        } finally {
            setSaving(false);
        }
    };

    const addLink = () => {
        // Add new link with a unique temporary ID
        setLinks([...links, {
            id: `new-${Date.now()}`,
            title: '',
            url: '',
            icon_type: 'website',
            order: links.length
        }]);
    };

    const removeLink = (i) => setLinks(links.filter((_, idx) => idx !== i));

    const updateLink = (i, field, value) => {
        const newLinks = [...links];
        newLinks[i][field] = value;
        if (field === 'url') {
            newLinks[i].icon_type = detectPlatform(value);
        }
        setLinks(newLinks);
    };

    // Drag End Handler
    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setLinks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Drag and drop handlers for Logo
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDraggingLogo(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDraggingLogo(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDraggingLogo(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setLogoFile(file);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
        }
    };

    const tabs = [
        { id: 'preview', label: 'Preview', icon: <FaEye /> },
        { id: 'edit', label: 'Edit', icon: <FaEdit /> },
        { id: 'customize', label: 'Customize', icon: <FaPalette />, disabled: true },
        { id: 'advanced', label: 'Advanced', icon: <FaCog />, disabled: true },
        { id: 'upgrade', label: 'Upgrade', icon: <FaStar />, disabled: true },
    ];

    // Preview data
    const previewName = formData.name || (isNew ? SAMPLE_DATA.name : 'Biznes nomi');
    const previewDesc = formData.description || (isNew ? SAMPLE_DATA.description : '');
    const previewLinks = links.length > 0 ? links : (isNew ? SAMPLE_DATA.links : []);

    if (loading) {
        return <div className="detail-loading"><div className="spinner"></div><p>Yuklanmoqda...</p></div>;
    }

    return (
        <div className="business-detail">
            <div className="detail-layout">
                {/* Left Sidebar */}
                <aside className="detail-sidebar">
                    <div className="sidebar-header">
                        <Link to="/dashboard" className="back-btn-sidebar">
                            <div className="back-icon-box">
                                <FaArrowLeft />
                            </div>
                            <span className="back-text">Orqaga</span>
                        </Link>
                    </div>

                    <nav className="sidebar-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab-item ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
                                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                                disabled={tab.disabled}
                            >
                                <span className={`tab-icon-box ${activeTab === tab.id ? 'active' : ''}`}>
                                    {tab.icon}
                                </span>
                                <span className="tab-label">{tab.label}</span>
                                {tab.disabled && <span className="soon-badge">Tez kunda</span>}
                            </button>
                        ))}
                    </nav>

                    {!isNew && business && (
                        <div className="sidebar-link">
                            <span className="link-label">Sizning link:</span>
                            <a href={`/${business.path}`} target="_blank" rel="noreferrer" className="link-url">
                                mylink.asia/{business.path}
                            </a>
                        </div>
                    )}
                </aside>

                {/* Main Content */}
                <main className="detail-content">
                    {activeTab === 'preview' && (
                        <div className="preview-section">
                            <div className="preview-phone">
                                {(logoPreview || logoFile) ? (
                                    <img src={logoFile ? URL.createObjectURL(logoFile) : logoPreview} className="preview-logo" alt="" />
                                ) : (
                                    <div className="preview-logo-placeholder">
                                        {previewName.charAt(0)}
                                    </div>
                                )}
                                <h2 className="preview-name">{previewName}</h2>
                                {previewDesc && <p className="preview-desc">{previewDesc}</p>}
                                <div className="preview-links">
                                    {previewLinks.map((link, i) => (
                                        <LinkButton key={i} link={{ ...link, icon_type: detectPlatform(link.url) }} index={i} />
                                    ))}
                                </div>
                                <div className="preview-footer">
                                    <span className="powered-text">Powered by</span>
                                    <img src="/logo.png" alt="MyLink" className="footer-brand-logo" />
                                    <strong>MyLink</strong>
                                </div>
                            </div>

                            {/* View Site Button */}
                            {!isNew && business && (
                                <a
                                    href={`/${business.path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="view-site-btn"
                                >
                                    <FaExternalLinkAlt /> Saytni ko'rish
                                </a>
                            )}
                        </div>
                    )}

                    {activeTab === 'edit' && (
                        <div className="edit-section">
                            {message.text && (
                                <div className={`message ${message.type}`}>{message.text}</div>
                            )}

                            <div className="edit-two-column">
                                {/* Left Column - Basic Info */}
                                <div className="edit-column">
                                    <div className="edit-card">
                                        <h3>Asosiy ma'lumotlar</h3>

                                        <div className="form-group">
                                            <label>Path</label>
                                            <div className={`input-prefix-group ${pathStatus === 'available' ? 'valid' : ''} ${pathStatus === 'taken' ? 'invalid' : ''}`}>
                                                <span>mylink.asia/</span>
                                                <input
                                                    value={formData.path}
                                                    onChange={handlePathChange}
                                                    placeholder="mybrand"
                                                />
                                            </div>
                                            {pathStatus && (
                                                <div className={`path-status ${pathStatus}`}>
                                                    {pathStatus === 'checking' && 'Tekshirilmoqda...'}
                                                    {pathStatus === 'available' && <><FaCheck /> Bu path bo'sh</>}
                                                    {pathStatus === 'taken' && <><FaTimes /> Bu path band</>}
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label>Biznes nomi</label>
                                            <input
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="Biznesingiz nomi"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Tavsif</label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Qisqacha tavsif..."
                                                rows={4}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Logo</label>
                                            <div
                                                className={`logo-dropzone ${isDraggingLogo ? 'dragging' : ''} ${logoFile || logoPreview ? 'has-image' : ''}`}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                                ref={dropZoneRef}
                                            >
                                                {(logoFile || logoPreview) ? (
                                                    <div className="logo-preview-container">
                                                        <img src={logoFile ? URL.createObjectURL(logoFile) : logoPreview} alt="" className="logo-preview-img" />
                                                        <div className="logo-overlay">
                                                            <label className="change-logo-btn">
                                                                O'zgartirish
                                                                <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                className="delete-logo-btn"
                                                                onClick={() => {
                                                                    setLogoFile(null);
                                                                    setLogoPreview(null);
                                                                    setLogoRemoved(true);
                                                                }}
                                                            >
                                                                <FaTrash /> O'chirish
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="dropzone-content">
                                                        <FaCloudUploadAlt className="upload-icon" />
                                                        <span className="upload-text">Rasm tashlang yoki tanlang</span>
                                                        <span className="upload-hint">PNG, JPG, max 2MB</span>
                                                        <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Links with Drag & Drop */}
                                <div className="edit-column">
                                    <div className="edit-card">
                                        <h3>Linklar</h3>

                                        {links.length === 0 ? (
                                            <div className="no-links">
                                                <p>Hali link yo'q</p>
                                                <button className="add-link-btn-large" onClick={addLink}>
                                                    <FaPlus /> Birinchi linkni qo'shing
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="links-list">
                                                    <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleDragEnd}
                                                    >
                                                        <SortableContext
                                                            items={links}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            {links.map((link, i) => (
                                                                <SortableLinkItem
                                                                    key={link.id}
                                                                    id={link.id}
                                                                    link={link}
                                                                    index={i}
                                                                    updateLink={updateLink}
                                                                    removeLink={removeLink}
                                                                    getPlatformIcon={getPlatformIcon}
                                                                    detectPlatform={detectPlatform}
                                                                />
                                                            ))}
                                                        </SortableContext>
                                                    </DndContext>
                                                </div>
                                                <button className="add-link-btn-bottom" onClick={addLink}>
                                                    <FaPlus /> Qo'shish
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button className="save-btn" onClick={handleSave} disabled={saving || (isNew && pathStatus === 'taken')}>
                                <FaSave /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                            </button>
                        </div>
                    )}

                    {(activeTab === 'customize' || activeTab === 'advanced' || activeTab === 'upgrade') && (
                        <div className="coming-soon-section">
                            <div className="coming-icon">🚀</div>
                            <h2>Tez kunda</h2>
                            <p>{tabs.find(t => t.id === activeTab)?.label} bo'limi tez orada qo'shiladi.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default BusinessDetail;
