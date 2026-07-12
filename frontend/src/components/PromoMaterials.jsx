import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from './Toast';
import { TEMPLATE_OPTIONS } from './templates/templateMeta';
import { FaQrcode, FaFilePdf, FaIdCard, FaInstagram, FaLock, FaDownload, FaCheck } from 'react-icons/fa';

// "Promomaterial" tab: every downloadable marketing asset for a business in
// one place — vizitka PDF (design picker, Pro), QR PNG (Oddiy+), A4 stand PDF
// (Pro) and the Instagram-story image (all tiers).
const PromoMaterials = ({ path, name }) => {
    const { t } = useTranslation();
    const toast = useToast();
    const { entitlements } = useEntitlements();

    const qrLevel = entitlements?.features?.qr || 'none';
    const canPng = qrLevel === 'png' || qrLevel === 'full';
    const canFull = qrLevel === 'full';

    const [design, setDesign] = useState('classic');
    const [qrPreview, setQrPreview] = useState(null);
    const [story, setStory] = useState({ src: null, file: null, busy: false });

    useEffect(() => {
        if (!canPng) return undefined;
        let url;
        let active = true;
        api.get(`businesses/${path}/qr.png`, { responseType: 'blob' })
            .then((res) => {
                if (!active) return;
                url = URL.createObjectURL(res.data);
                setQrPreview(url);
            })
            .catch(() => { /* preview unavailable — downloads still work */ });
        return () => {
            active = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [path, canPng]);

    const download = async (seg, query = '', filename = null) => {
        try {
            const res = await api.get(`businesses/${path}/${seg}${query}`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `${path}-${seg}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error(t('common.error'));
        }
    };

    // Build the ready-made Instagram-story image and preview it. From the
    // preview the user shares it to IG (mobile share sheet) or downloads it.
    const openStory = async () => {
        setStory({ src: null, file: null, busy: true });
        try {
            const res = await api.get(`businesses/${path}/story.png`, { responseType: 'blob' });
            const file = new File([res.data], `${path}-story.png`, { type: 'image/png' });
            setStory({ src: URL.createObjectURL(res.data), file, busy: false });
        } catch {
            setStory({ src: null, file: null, busy: false });
            toast.error(t('common.error'));
        }
    };

    const shareStory = async () => {
        if (story.file && navigator.canShare && navigator.canShare({ files: [story.file] })) {
            try {
                await navigator.share({ files: [story.file], title: name });
                return;
            } catch {
                /* dismissed — fall through to download */
            }
        }
        const a = document.createElement('a');
        a.href = story.src;
        a.download = `${path}-story.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.info(t('detail.story_hint'));
    };

    const proLock = (
        <Link to="/pricing" className="qr-dl locked">
            <FaLock /> {t('detail.qr_pro')} · {t('limit.see_plans')}
        </Link>
    );

    return (
        <div className="promo-tab">
            <h3 className="promo-title">{t('promomat.title')}</h3>
            <p className="promo-sub">{t('promomat.desc')}</p>

            <div className="promo-grid">
                {/* Vizitka PDF — design picker (Pro) */}
                <div className="promo-card">
                    <h4><FaIdCard /> {t('promomat.vizitka')}</h4>
                    <p>{t('promomat.vizitka_desc')}</p>
                    <div className="promo-designs">
                        {TEMPLATE_OPTIONS.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                className={`promo-swatch ${design === o.id ? 'sel' : ''}`}
                                style={{ background: `linear-gradient(135deg, ${o.bg} 55%, ${o.accent})` }}
                                title={t(`tpl.${o.id}`)}
                                onClick={() => setDesign(o.id)}
                            >
                                {design === o.id && <FaCheck />}
                            </button>
                        ))}
                    </div>
                    <div className="promo-design-name">{t(`tpl.${design}`)}</div>
                    {canFull ? (
                        <button type="button" className="qr-dl" onClick={() => download('card.pdf', `?design=${design}`, `${path}-card-${design}.pdf`)}>
                            <FaDownload /> {t('promomat.download')}
                        </button>
                    ) : proLock}
                </div>

                {/* QR PNG (Oddiy+) */}
                <div className="promo-card">
                    <h4><FaQrcode /> {t('promomat.qr')}</h4>
                    <p>{t('promomat.qr_desc')}</p>
                    {canPng ? (
                        <>
                            <div className="promo-qr">
                                {qrPreview ? <img src={qrPreview} alt="QR" /> : <div className="spinner" />}
                            </div>
                            <button type="button" className="qr-dl" onClick={() => download('qr.png')}>
                                <FaDownload /> {t('promomat.download')}
                            </button>
                        </>
                    ) : (
                        <Link to="/pricing" className="qr-dl locked">
                            <FaLock /> {t('detail.qr_free')}
                        </Link>
                    )}
                </div>

                {/* Stand — A4 PDF (Pro) */}
                <div className="promo-card">
                    <h4><FaFilePdf /> {t('promomat.stand')}</h4>
                    <p>{t('promomat.stand_desc')}</p>
                    {canFull ? (
                        <button type="button" className="qr-dl" onClick={() => download('qr.pdf')}>
                            <FaDownload /> {t('promomat.download')}
                        </button>
                    ) : proLock}
                </div>

                {/* Instagram story (all tiers) */}
                <div className="promo-card">
                    <h4><FaInstagram style={{ color: '#e1306c' }} /> {t('detail.story_title')}</h4>
                    <p>{t('detail.story_desc')}</p>
                    {story.src && (
                        <div className="promo-story">
                            <img src={story.src} alt="Instagram story" />
                        </div>
                    )}
                    {story.src ? (
                        <button type="button" className="qr-dl" onClick={shareStory}>
                            <FaDownload /> {t('detail.story_share')}
                        </button>
                    ) : (
                        <button type="button" className="qr-dl" disabled={story.busy} onClick={openStory}>
                            {story.busy ? t('common.loading') : <><FaInstagram /> {t('promomat.story_make')}</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PromoMaterials;
