import React, { useCallback, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaArrowRight, FaCheck, FaTimes, FaCloudUploadAlt, FaTrash, FaLock, FaRocket } from 'react-icons/fa';
import api from '../api';
import { useToast } from '../components/Toast';
import { useEntitlements } from '../context/EntitlementContext';
import LogoCropper from '../components/LogoCropper';
import { TEMPLATE_OPTIONS } from '../components/templates/templateMeta';
import { PALETTES, PALETTE_IDS } from '../lib/palettes';

// Two-step creation wizard: 1) info (path/name/desc/logo) → 2) design
// (template + palette cards on the left, live phone preview on the right).

const SAMPLE_LINKS = ['Instagram', 'Telegram', 'WhatsApp'];

// Live mini-preview of the public page for the chosen template/palette.
const WizardPreview = ({ form, logoUrl, option, palette }) => {
    const isClassic = option.id === 'classic';
    const pal = isClassic ? palette : null;
    const bg = isClassic
        ? (pal?.bg || 'linear-gradient(165deg,#312e81,#0f0f1a)')
        : option.bg;
    const accent = isClassic ? (pal?.accent || '#6366f1') : option.accent;
    const surface = isClassic ? 'rgba(255,255,255,.08)' : option.surface;
    const textColor = option.light && !isClassic ? '#1f2430' : '#fff';
    const subColor = option.light && !isClassic ? '#6b7280' : 'rgba(255,255,255,.72)';

    return (
        <div className="wiz-phone">
            <div className="wiz-notch"></div>
            <div className="wiz-screen" style={{ background: bg }}>
                {logoUrl ? (
                    <img src={logoUrl} alt="" className="wiz-ava" />
                ) : (
                    <div className="wiz-ava wiz-ava-ph" style={{ background: accent }}>
                        {(form.name || 'M').charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="wiz-name" style={{ color: textColor }}>{form.name || 'Mening biznesim'}</div>
                <div className="wiz-path" style={{ color: subColor }}>mylink.asia/{form.path || 'brand'}</div>
                {form.description && (
                    <div className="wiz-bio" style={{ color: subColor }}>{form.description}</div>
                )}
                <div className="wiz-links">
                    {SAMPLE_LINKS.map((l) => (
                        <span key={l} className="wiz-link" style={{
                            background: surface,
                            color: textColor,
                            border: option.light && !isClassic ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,.12)',
                        }}>
                            <i style={{ background: accent }}></i> {l}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

const NewBusiness = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const { entitlements, refresh: refreshEntitlements } = useEntitlements();
    const canColor = !!entitlements?.features?.color_edit;

    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ path: '', name: '', description: '', template: 'classic', theme: 'default' });
    const [logoFile, setLogoFile] = useState(null);
    const [cropSrc, setCropSrc] = useState(null);
    const [saving, setSaving] = useState(false);
    const [pathStatus, setPathStatus] = useState(null); // null | checking | available | taken
    const pathTimer = useRef(null);

    const logoUrl = logoFile ? URL.createObjectURL(logoFile) : null;
    const option = TEMPLATE_OPTIONS.find((o) => o.id === form.template) || TEMPLATE_OPTIONS[0];
    const palette = PALETTES[form.theme] || PALETTES.default;

    const checkPath = useCallback(async (value) => {
        if (!value || value.length < 2) { setPathStatus(null); return; }
        setPathStatus('checking');
        try {
            await api.get(`public/${value}/`);
            setPathStatus('taken');
        } catch (err) {
            // 404 from the public endpoint MAY still hide a locked page — the
            // create call is the source of truth; this is just a fast hint.
            setPathStatus(err.response?.status === 404 ? 'available' : null);
        }
    }, []);

    const onPathChange = (e) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        setForm((f) => ({ ...f, path: value }));
        if (pathTimer.current) clearTimeout(pathTimer.current);
        pathTimer.current = setTimeout(() => checkPath(value), 500);
    };

    const openCropper = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => setCropSrc(reader.result);
        reader.readAsDataURL(file);
    };

    const step1Valid = form.name.trim().length > 0 && form.path.length >= 2 && pathStatus !== 'taken';

    const create = async () => {
        setSaving(true);
        try {
            const res = await api.post('businesses/', { ...form, links: [] });
            if (logoFile) {
                const fd = new FormData();
                fd.append('logo_upload', logoFile);
                await api.patch(`businesses/${res.data.path}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            await refreshEntitlements();
            toast.success(t('wizard.created'));
            if (res.data.is_locked) toast.info(t('limit.created_inactive'));
            navigate(`/business/${res.data.path}`);
        } catch (err) {
            if (err.response?.data?.path) {
                setStep(1);
                setPathStatus('taken');
                toast.error(t('detail.path_taken'));
            } else {
                toast.error(t('common.error'));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="wizard-page">
            <div className="wizard-head">
                <Link to="/dashboard" className="wiz-back"><FaArrowLeft /> {t('common.back')}</Link>
                <div className="wiz-steps">
                    <div className={`wiz-step ${step === 1 ? 'cur' : 'done'}`}>
                        <span className="ws-dot">{step > 1 ? <FaCheck /> : '1'}</span>
                        {t('wizard.step_info')}
                    </div>
                    <span className="ws-line"></span>
                    <div className={`wiz-step ${step === 2 ? 'cur' : ''}`}>
                        <span className="ws-dot">2</span>
                        {t('wizard.step_design')}
                    </div>
                </div>
                <span style={{ width: 90 }}></span>
            </div>

            {step === 1 ? (
                <div className="wizard-card">
                    <h2>{t('wizard.info_title')}</h2>
                    <p className="wiz-sub">{t('wizard.info_sub')}</p>

                    <div className="form-group">
                        <label>{t('detail.path')}</label>
                        <div className={`input-prefix-group ${pathStatus === 'available' ? 'valid' : ''} ${pathStatus === 'taken' ? 'invalid' : ''}`}>
                            <span>mylink.asia/</span>
                            <input value={form.path} onChange={onPathChange} placeholder="mybrand" />
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
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('detail.business_name_ph')} />
                    </div>

                    <div className="form-group">
                        <label>{t('detail.description')}</label>
                        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('detail.description_ph')} rows={3} />
                    </div>

                    <div className="form-group">
                        <label>{t('detail.logo')}</label>
                        {logoFile ? (
                            <div className="wiz-logo-row">
                                <img src={logoUrl} alt="" />
                                <button type="button" className="wiz-logo-del" onClick={() => setLogoFile(null)}>
                                    <FaTrash /> {t('common.delete')}
                                </button>
                            </div>
                        ) : (
                            <label className="wiz-drop">
                                <FaCloudUploadAlt />
                                <span>{t('detail.drop_image')}</span>
                                <input type="file" accept="image/*" hidden onChange={(e) => { openCropper(e.target.files[0]); e.target.value = ''; }} />
                            </label>
                        )}
                    </div>

                    <button className="save-btn" style={{ width: '100%', justifyContent: 'center' }} disabled={!step1Valid} onClick={() => setStep(2)}>
                        {t('wizard.continue')} <FaArrowRight />
                    </button>
                </div>
            ) : (
                <div className="wizard-design">
                    <div className="wiz-left">
                        <h2>{t('wizard.design_title')}</h2>
                        <p className="wiz-sub">{t('wizard.design_sub')}</p>

                        <div className="wiz-tpl-grid">
                            {TEMPLATE_OPTIONS.map((o) => {
                                const selected = form.template === o.id;
                                return (
                                    <button key={o.id} type="button" onClick={() => setForm({ ...form, template: o.id })}
                                        className={`wiz-tpl ${selected ? 'sel' : ''}`}
                                        style={selected ? { borderColor: o.accent, boxShadow: `0 8px 22px -12px ${o.accent}` } : undefined}>
                                        <span className="wt-prev" style={{ background: o.bg, borderColor: o.light ? '#e5e7eb' : 'transparent' }}>
                                            <i style={{ background: o.accent }}></i>
                                            <em style={{ background: o.surface }}></em>
                                            <em style={{ background: o.surface }}></em>
                                        </span>
                                        <span className="wt-name">
                                            {t(`tpl.${o.id}`)}
                                            {selected && <FaCheck style={{ color: o.accent }} />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {form.template === 'classic' && (
                            <div className="wiz-palette">
                                <h3>
                                    {t('theme.title')}
                                    {!canColor && <span className="wiz-pro-badge"><FaLock /> Pro</span>}
                                </h3>
                                <div className="wiz-pal-row">
                                    {PALETTE_IDS.map((id) => (
                                        <button key={id} type="button"
                                            className={`wiz-swatch ${form.theme === id ? 'sel' : ''}`}
                                            style={{ background: PALETTES[id].swatch }}
                                            disabled={!canColor && id !== 'default'}
                                            title={t(`theme.${id}`)}
                                            onClick={() => setForm({ ...form, theme: id })}>
                                            {form.theme === id && <FaCheck />}
                                        </button>
                                    ))}
                                </div>
                                {!canColor && <p className="wiz-pal-hint">{t('theme.locked')}</p>}
                            </div>
                        )}

                        <div className="wiz-actions">
                            <button type="button" className="wiz-back-btn" onClick={() => setStep(1)}>
                                <FaArrowLeft /> {t('wizard.back')}
                            </button>
                            <button type="button" className="save-btn" disabled={saving} onClick={create}>
                                <FaRocket /> {saving ? t('wizard.creating') : t('wizard.create')}
                            </button>
                        </div>
                    </div>

                    <div className="wiz-right">
                        <div className="wiz-prev-label">{t('wizard.preview')}</div>
                        <WizardPreview form={form} logoUrl={logoUrl} option={option} palette={palette} />
                    </div>
                </div>
            )}

            {cropSrc && (
                <LogoCropper
                    src={cropSrc}
                    onCancel={() => setCropSrc(null)}
                    onComplete={(file) => { setLogoFile(file); setCropSrc(null); }}
                />
            )}
        </div>
    );
};

export default NewBusiness;
