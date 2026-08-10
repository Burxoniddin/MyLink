import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { FaArrowLeft, FaEye, FaEdit, FaPalette, FaCopy, FaShareAlt, FaQrcode, FaLayerGroup, FaUsers, FaPlus, FaTimes, FaSave, FaCloudUploadAlt, FaExternalLinkAlt, FaCheck, FaTrash, FaGripLines, FaBars, FaSun, FaMoon } from 'react-icons/fa';
import { getLinkIcon } from '../lib/linkIcons';
import { detectPlatform, normalizeUrl } from '../lib/linkUtils';
import PreviewPane from '../components/PreviewPane';
import MediaSections from '../components/MediaSections';
import PromoMaterials from '../components/PromoMaterials';
import TeamManager from '../components/TeamManager';
import LogoCropper from '../components/LogoCropper';
import TemplatePicker from '../components/templates/TemplatePicker';
import { TEMPLATE_META } from '../components/templates/templateMeta';
import ThemePicker from '../components/ThemePicker';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';

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

// Editor row icon — same lookup the public templates use.
const getPlatformIcon = (type) => getLinkIcon(type);

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
    const toast = useToast();
    const { entitlements } = useEntitlements();
    const [activeTab, setActiveTab] = useState('edit');
    const [business, setBusiness] = useState(null);
    const [formData, setFormData] = useState({ path: '', name: '', description: '', template: 'classic', theme: 'default', theme_mode: '' });
    const [links, setLinks] = useState([]);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [logoRemoved, setLogoRemoved] = useState(false);
    const [cropSrc, setCropSrc] = useState(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [role, setRole] = useState(null); // null while new; 'owner'|'admin'|'editor'|'viewer'
    const [copied, setCopied] = useState(false);
    // Sidebar: open by default, collapsible to an icon-only rail (persisted).
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mylink-sidebar-collapsed') === '1');
    const toggleCollapsed = () => {
        setCollapsed((c) => {
            localStorage.setItem('mylink-sidebar-collapsed', c ? '0' : '1');
            return !c;
        });
    };

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
            setRole(res.data.role || null);
            setFormData({ path: res.data.path, name: res.data.name, description: res.data.description || '', template: res.data.template || 'classic', theme: res.data.theme || 'default', theme_mode: res.data.theme_mode || '' });

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

    // Story-first share: build the ready IG-story image and hand it straight to
    // the system share sheet — on the phone the user just picks Instagram →
    // Stories → publish. Falls back to a URL share, then to copying the link.
    const handleShare = async () => {
        try {
            if (navigator.canShare) {
                const res = await api.get(`businesses/${business.path}/story.png`, { responseType: 'blob' });
                const file = new File([res.data], `${business.path}-story.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: business.name });
                    return;
                }
            }
            if (navigator.share) {
                await navigator.share({ title: business.name, url: publicUrl });
                return;
            }
            handleCopy();
        } catch (err) {
            if (err?.name === 'AbortError') return; // user closed the share sheet
            handleCopy(); // image fetch/share failed — at least copy the link
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

            setMessage({ type: '', text: '' });
            toast.success(t('detail.saved'));

            // Redirect to preview after save
            if (isNew) {
                navigate(`/business/${res.data.path}`);
            } else {
                await fetchBusiness();
            }
            setActiveTab('preview');
        } catch (err) {
            if (err.response?.data?.path) {
                toast.error(t('detail.path_taken'));
            } else {
                toast.error(t('common.error'));
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

    // Role-based capabilities. A brand-new page has no role yet but its creator
    // is the owner, so editing is allowed.
    const canEdit = isNew || role !== 'viewer';
    const canManageTeam = !isNew && (role === 'owner' || role === 'admin');

    const tabs = [
        { id: 'preview', label: t('detail.tab_preview'), icon: <FaEye /> },
        { id: 'edit', label: t('detail.tab_edit'), icon: <FaEdit /> },
        ...(!isNew ? [{ id: 'blocks', label: t('detail.tab_blocks'), icon: <FaLayerGroup /> }] : []),
        { id: 'customize', label: t('detail.tab_customize'), icon: <FaPalette /> },
        ...(canManageTeam ? [{ id: 'team', label: t('detail.tab_team'), icon: <FaUsers /> }] : []),
        ...(!isNew ? [{ id: 'promo', label: t('detail.tab_promo'), icon: <FaQrcode /> }] : []),
    ];

    // Preview data
    const previewName = formData.name || (isNew ? SAMPLE_DATA.name : t('detail.business_name'));
    const previewDesc = formData.description || (isNew ? SAMPLE_DATA.description : '');
    const previewLinks = links.length > 0 ? links : (isNew ? SAMPLE_DATA.links : []);
    const previewLogoUrl = useMemo(() => {
        if (logoFile) return URL.createObjectURL(logoFile);
        if (logoRemoved) return null;
        return logoPreview;
    }, [logoFile, logoRemoved, logoPreview]);
    useEffect(() => () => {
        if (previewLogoUrl?.startsWith('blob:')) URL.revokeObjectURL(previewLogoUrl);
    }, [previewLogoUrl]);
    const previewPane = (
        <PreviewPane
            formData={{ ...formData, name: previewName, description: previewDesc }}
            links={previewLinks}
            logoUrl={previewLogoUrl}
            sections={business?.media_sections || []}
            verified={!!business?.verified}
            brandingRemoved={!!business?.branding_removed}
        />
    );

    if (loading) {
        return <div className="detail-loading"><div className="spinner"></div><p>{t('common.loading')}</p></div>;
    }

    return (
        <div className="business-detail">
            <div className="detail-layout">
                {/* Left Sidebar */}
                <aside className={`detail-sidebar ${collapsed ? 'collapsed' : ''}`}>
                    <div className="sidebar-header">
                        <Link to="/dashboard" className="back-btn-sidebar">
                            <div className="back-icon-box">
                                <FaArrowLeft />
                            </div>
                            <span className="back-text">{t('common.back')}</span>
                        </Link>
                        <button
                            type="button"
                            className="sidebar-collapse-btn"
                            onClick={toggleCollapsed}
                            title={t('detail.collapse')}
                            aria-label={t('detail.collapse')}
                        >
                            <FaBars />
                        </button>
                    </div>

                    <nav className="sidebar-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                title={tab.label}
                            >
                                <span className={`tab-icon-box ${activeTab === tab.id ? 'active' : ''}`}>
                                    {tab.icon}
                                </span>
                                <span className="tab-label">{tab.label}</span>
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
                    {activeTab === 'preview' && (
                        <div className="preview-section pv-layout">
                            {previewPane}
                            {!isNew && business && (
                                <div className="pv-actions">
                                    <a
                                        href={`/${business.path}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="pv-action-btn primary"
                                    >
                                        <FaExternalLinkAlt /> <span className="pv-btn-label">{t('detail.view_site')}</span>
                                    </a>
                                    <button type="button" className="pv-action-btn icon-btn" onClick={handleShare} title={t('detail.share')}>
                                        <FaShareAlt /> <span className="pv-btn-label">{t('detail.share')}</span>
                                    </button>
                                    <button type="button" className="pv-action-btn icon-btn" onClick={handleCopy} title={t('detail.copy_link')}>
                                        {copied ? <FaCheck /> : <FaCopy />} <span className="pv-btn-label">{copied ? t('detail.copied') : t('detail.copy_link')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'edit' && (
                        <div className="edit-section">
                            {message.text && (
                                <div className={`message ${message.type}`}>{message.text}</div>
                            )}
                            {!canEdit && (
                                <div className="message" style={{ background: '#f3f4f6', color: '#374151' }}>
                                    {t('detail.readonly')}
                                </div>
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

                            {canEdit && (
                                <button className="save-btn" onClick={handleSave} disabled={saving || (isNew && pathStatus === 'taken')}>
                                    <FaSave /> {saving ? t('detail.saving') : t('common.save')}
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'blocks' && !isNew && business && (
                        <div className="edit-section">
                            <MediaSections
                                path={business.path}
                                onChanged={(sections) => setBusiness((b) => (b ? { ...b, media_sections: sections } : b))}
                            />
                        </div>
                    )}

                    {activeTab === 'customize' && (
                        <div className="edit-section">
                            <div className="customize-layout">
                                <div className="customize-controls">
                                    <TemplatePicker
                                        value={formData.template}
                                        onChange={(tpl) => setFormData({ ...formData, template: tpl })}
                                        allowed={entitlements?.features?.templates ?? 1}
                                    />
                                    {/* Owner-chosen dark/light mode — the public page renders in this mode. */}
                                    <div className="mode-picker">
                                        <h3>{t('theme.mode')}</h3>
                                        <div className="mode-btns">
                                            {['dark', 'light'].map((m) => {
                                                const effective = formData.theme_mode
                                                    || (formData.template === 'classic' ? 'dark' : (TEMPLATE_META[formData.template]?.defaultTheme || 'dark'));
                                                return (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        className={`mode-btn ${effective === m ? 'sel' : ''}`}
                                                        onClick={() => setFormData({ ...formData, theme_mode: m })}
                                                    >
                                                        {m === 'dark' ? <FaMoon /> : <FaSun />} {t(`theme.mode_${m}`)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {formData.template === 'classic' && (
                                        <ThemePicker
                                            value={formData.theme}
                                            onChange={(id) => setFormData({ ...formData, theme: id })}
                                            locked={!entitlements?.features?.color_edit}
                                        />
                                    )}
                                    {canEdit && (
                                        <button className="save-btn" style={{ marginTop: 24 }} onClick={handleSave}
                                            disabled={saving || (isNew && pathStatus === 'taken')}>
                                            {saving ? t('detail.saving') : t('common.save')}
                                        </button>
                                    )}
                                </div>
                                <div className="customize-preview">
                                    {previewPane}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && canManageTeam && (
                        <div className="edit-section">
                            <TeamManager path={business.path} />
                        </div>
                    )}

                    {activeTab === 'promo' && !isNew && business && (
                        <div className="edit-section">
                            <PromoMaterials path={business.path} name={business.name} />
                        </div>
                    )}
                </main>
            </div>

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
