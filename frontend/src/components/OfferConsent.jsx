import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSiteSettings } from '../lib/siteSettings';

// Ommaviy oferta roziligi. Ikki ko'rinishda ishlatiladi:
//  - checkbox (NFC to'lovi): to'lashdan oldin belgilash SHART;
//  - note (kirish/ro'yxatdan o'tish): davom etish = rozilik degan eslatma.
// Ikkalasida ham "Ofertani o'qish" havolasi hujjatni yangi oynada ochadi
// (admin yuklagan PDF yoki avtomatik yig'iladigan hujjat).
const OfferConsent = ({ checked = false, onChange, note = false }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');

    useEffect(() => {
        let alive = true;
        fetchSiteSettings().then((s) => { if (alive) setUrl(s?.offer_url || ''); });
        return () => { alive = false; };
    }, []);

    const link = (
        <a className="offer-link" href={url || undefined} target="_blank" rel="noopener noreferrer">
            {t('offer.read')}
        </a>
    );

    if (note) {
        return <p className="offer-note">{t('offer.note')} {link}</p>;
    }

    return (
        <label className="offer-check">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange?.(e.target.checked)}
            />
            <span>{t('offer.accept')} {link}</span>
        </label>
    );
};

export default OfferConsent;
