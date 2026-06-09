import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { FaLink, FaArrowLeft, FaEye, FaEdit, FaPalette, FaCog, FaStar, FaRegStar, FaCopy, FaShareAlt, FaQrcode, FaLock, FaFilePdf, FaIdCard, FaLayerGroup, FaPlus, FaTimes, FaSave, FaBars, FaTelegram, FaInstagram, FaFacebook, FaWhatsapp, FaPhone, FaGlobe, FaLinkedin, FaCloudUploadAlt, FaExternalLinkAlt, FaCheck, FaTrash, FaYoutube, FaEnvelope, FaGripLines, FaTiktok, FaYandex, FaMapMarkedAlt } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import LinkButton from '../components/LinkButton';
import ContentBlocks from '../components/ContentBlocks';
import LogoCropper from '../components/LogoCropper';
import TemplatePicker from '../components/templates/TemplatePicker';
import ThemePicker from '../components/ThemePicker';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';

// Drag & Drop
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component
const SortableLinkItem = ({ id, link, index, updateLink, removeLink, getPlatformIcon, detectPlatform }) => {
    const { t } = useTranslation();
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
                    placeholder={t('detail.link_name_ph')}
                    value={link.title}
                    onChange={e => updateLink(index, 'title', e.target.value)}
                />
                <input
                    placeholder={t('detail.link_url_ph')}
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
    const { t } = useTranslation();
    const { entitlements } = useEntitlements();
    const [activeTab, setActiveTab] = useState('edit');
    const [business, setBusiness] = useState(null);
    const [formData, setFormData] = useState({ path: '', name: '', description: '', template: 'classic', theme: 'default' });
    const [links, setLinks] = useState([]);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [logoRemoved, setLogoRemoved] = useState(false);
    const [cropSrc, setCropSrc] = useState(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [pinned, setPinned] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [qrPreview, setQrPreview] = useState(null);

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
            setPinned(!!res.data.is_pinned);
            setFormData({ path: res.data.path, name: res.data.name, description: res.data.description || '', template: res.data.template || 'classic', theme: res.data.theme || 'default' });

            // Generate IDs for existing links to make them sortable
            const linksWithIds = (res.data.links || []).map((link, idx) => ({
                ...link,
                id: link.id || `temp-${Date.now()}-${idx}` // Use existing ID or temporary ID
            }));
            setLinks(linksWithIds);

            setLogoPreview(res.data.logo);
            setLogoRemoved(false);
        } catch {
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const publicUrl = business ? `${window.location.origin}/${business.path}` : '';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard unavailable (e.g. insecure context) — ignore */
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: business.name, url: publicUrl });
            } catch {
                /* user dismissed the share sheet */
            }
        } else {
            handleCopy();
        }
    };

    const handlePin = async () => {
        const next = !pinned;
        setPinned(next); // optimistic
        try {
            await api.post(`businesses/${business.path}/pin/`, { is_pinned: next });
        } catch {
            setPinned(!next); // revert on failure
        }
    };

    const qrLevel = entitlements?.features?.qr || 'none';
    const canQrPng = qrLevel === 'png' || qrLevel === 'full';
    const canQrFull = qrLevel === 'full';

    const openQr = async () => {
        setShowQr(true);
        if (!canQrPng) return;
        setQrPreview(null); // show loading, then fetch a fresh preview
        try {
            const res = await api.get(`businesses/${business.path}/qr.png`, { responseType: 'blob' });
            setQrPreview(URL.createObjectURL(res.data));
        } catch {
            /* preview unavailable — downloads still work */
        }
    };

    const downloadAsset = async (seg) => {
        try {
            const res = await api.get(`businesses/${business.path}/${seg}`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${business.path}-${seg}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            /* ignore download failure */
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

            setMessage({ type: 'success', text: t('detail.saved') });

            // Redirect to preview after save
            if (isNew) {
                navigate(`/business/${res.data.path}`);
            } else {
                await fetchBusiness();
            }
            setActiveTab('preview');
        } catch (err) {
            if (err.response?.data?.path) {
                setMessage({ type: 'error', text: t('detail.path_taken') });
            } else {
                setMessage({ type: 'error', text: t('common.error') });
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

    // Open the square crop modal for a freshly selected image.
    const openCropper = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => setCropSrc(reader.result);
        reader.readAsDataURL(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDraggingLogo(false);
        openCropper(e.dataTransfer.files[0]);
    };

    const handleFileSelect = (e) => {
        openCropper(e.target.files[0]);
        e.target.value = ''; // allow re-selecting the same file
    };

    const tabs = [
        { id: 'preview', label: t('detail.tab_preview'), icon: <FaEye /> },
        { id: 'edit', label: t('detail.tab_edit'), icon: <FaEdit /> },
        ...(!isNew ? [{ id: 'blocks', label: t('detail.tab_blocks'), icon: <FaLayerGroup /> }] : []),
        { id: 'customize', label: t('detail.tab_customize'), icon: <FaPalette /> },
        { id: 'advanced', label: t('detail.tab_advanced'), icon: <FaCog />, disabled: true },
        { id: 'upgrade', label: t('detail.tab_upgrade'), icon: <FaStar />, disabled: true },
    ];

    // Preview data
    const previewName = formData.name || (isNew ? SAMPLE_DATA.name : t('detail.business_name'));
    const previewDesc = formData.description || (isNew ? SAMPLE_DATA.description : '');
    const previewLinks = links.length > 0 ? links : (isNew ? SAMPLE_DATA.links : []);

    if (loading) {
        return <div className="detail-loading"><div className="spinner"></div><p>{t('common.loading')}</p></div>;
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
                            <span className="back-text">{t('common.back')}</span>
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
                                {tab.disabled && <span className="soon-badge">{t('detail.soon')}</span>}
                            </button>
                        ))}
                    </nav>

                    {!isNew && business && (
                        <div className="sidebar-link">
                            <span className="link-label">{t('detail.your_link')}</span>
                            <a href={`/${business.path}`} target="_blank" rel="noreferrer" className="link-url">
                                mylink.asia/{business.path}
                            </a>
                        </div>
                    )}
                </aside>

                {/* Main Content */}
                <main className="detail-content">
                    {!isNew && business && (
                        <div className="detail-toolbar">
                            <button type="button" className="toolbar-btn" onClick={handleCopy}>
                                {copied ? <FaCheck /> : <FaCopy />}
                                <span>{copied ? t('detail.copied') : t('detail.copy_link')}</span>
                            </button>
                            <button type="button" className="toolbar-btn" onClick={handleShare}>
                                <FaShareAlt /> <span>{t('detail.share')}</span>
                            </button>
                            <a className="toolbar-btn" href={`/${business.path}`} target="_blank" rel="noreferrer">
                                <FaExternalLinkAlt /> <span>{t('detail.tab_preview')}</span>
                            </a>
                            <button type="button" className={`toolbar-btn ${pinned ? 'pinned' : ''}`} onClick={handlePin}>
                                {pinned ? <FaStar /> : <FaRegStar />}
                                <span>{pinned ? t('detail.pinned') : t('detail.pin')}</span>
                            </button>
                            <button type="button" className="toolbar-btn" onClick={openQr}>
                                <FaQrcode /> <span>{t('detail.qr_button')}</span>
                            </button>
                        </div>
                    )}
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
                                    <FaExternalLinkAlt /> {t('detail.view_site')}
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
                                        <h3>{t('detail.basic_info')}</h3>

                                        <div className="form-group">
                                            <label>{t('detail.path')}</label>
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
                                                    {pathStatus === 'checking' && t('detail.checking')}
                                                    {pathStatus === 'available' && <><FaCheck /> {t('detail.path_available')}</>}
                                                    {pathStatus === 'taken' && <><FaTimes /> {t('detail.path_taken')}</>}
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label>{t('detail.business_name')}</label>
                                            <input
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder={t('detail.business_name_ph')}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>{t('detail.description')}</label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                placeholder={t('detail.description_ph')}
                                                rows={4}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>{t('detail.logo')}</label>
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
                                                                {t('detail.change')}
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
                                                                <FaTrash /> {t('common.delete')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="dropzone-content">
                                                        <FaCloudUploadAlt className="upload-icon" />
                                                        <span className="upload-text">{t('detail.drop_image')}</span>
                                                        <span className="upload-hint">{t('detail.image_hint')}</span>
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
                                        <h3>{t('detail.links')}</h3>

                                        {links.length === 0 ? (
                                            <div className="no-links">
                                                <p>{t('detail.no_links_yet')}</p>
                                                <button className="add-link-btn-large" onClick={addLink}>
                                                    <FaPlus /> {t('detail.add_first_link')}
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
                                                    <FaPlus /> {t('common.add')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button className="save-btn" onClick={handleSave} disabled={saving || (isNew && pathStatus === 'taken')}>
                                <FaSave /> {saving ? t('detail.saving') : t('common.save')}
                            </button>
                        </div>
                    )}

                    {activeTab === 'blocks' && !isNew && business && (
                        <div className="edit-section">
                            <ContentBlocks path={business.path} />
                        </div>
                    )}

                    {activeTab === 'customize' && (
                        <div className="edit-section">
                            <TemplatePicker
                                value={formData.template}
                                onChange={(tpl) => setFormData({ ...formData, template: tpl })}
                            />
                            {formData.template === 'classic' && (
                                <ThemePicker
                                    value={formData.theme}
                                    onChange={(id) => setFormData({ ...formData, theme: id })}
                                    locked={!entitlements?.features?.color_edit}
                                />
                            )}
                            <button className="save-btn" style={{ marginTop: 24 }} onClick={handleSave}
                                disabled={saving || (isNew && pathStatus === 'taken')}>
                                {saving ? t('detail.saving') : t('common.save')}
                            </button>
                        </div>
                    )}

                    {(activeTab === 'advanced' || activeTab === 'upgrade') && (
                        <div className="coming-soon-section">
                            <div className="coming-icon">🚀</div>
                            <h2>{t('detail.soon')}</h2>
                            <p>{t('detail.soon_section', { section: tabs.find(t2 => t2.id === activeTab)?.label })}</p>
                        </div>
                    )}
                </main>
            </div>

            {showQr && (
                <div className="qr-modal-overlay" onClick={() => setShowQr(false)}>
                    <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="qr-modal-close" onClick={() => setShowQr(false)} aria-label="close">
                            <FaTimes />
                        </button>
                        <h2>{t('detail.qr_title')}</h2>

                        {canQrPng ? (
                            <>
                                <div className="qr-preview">
                                    {qrPreview
                                        ? <img src={qrPreview} alt="QR" />
                                        : <div className="spinner" />}
                                </div>
                                <div className="qr-actions">
                                    <button type="button" className="qr-dl" onClick={() => downloadAsset('qr.png')}>
                                        <FaQrcode /> {t('detail.qr_png')}
                                    </button>
                                    {canQrFull ? (
                                        <>
                                            <button type="button" className="qr-dl" onClick={() => downloadAsset('qr.pdf')}>
                                                <FaFilePdf /> {t('detail.qr_pdf')}
                                            </button>
                                            <button type="button" className="qr-dl" onClick={() => downloadAsset('card.pdf')}>
                                                <FaIdCard /> {t('detail.qr_card')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <Link to="/pricing" className="qr-dl locked">
                                                <FaLock /> {t('detail.qr_pdf')} · {t('detail.qr_pro')}
                                            </Link>
                                            <Link to="/pricing" className="qr-dl locked">
                                                <FaLock /> {t('detail.qr_card')} · {t('detail.qr_pro')}
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="qr-upsell">
                                <FaLock className="qr-upsell-icon" />
                                <p>{t('detail.qr_free')}</p>
                                <Link to="/pricing" className="qr-dl">{t('limit.see_plans')}</Link>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {cropSrc && (
                <LogoCropper
                    src={cropSrc}
                    onCancel={() => setCropSrc(null)}
                    onComplete={(file) => {
                        setLogoFile(file);
                        setLogoRemoved(false);
                        setCropSrc(null);
                    }}
                />
            )}
        </div>
    );
};

export default BusinessDetail;
