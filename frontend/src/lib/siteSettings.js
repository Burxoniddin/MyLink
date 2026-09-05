import api from '../api';

// Ommaviy sozlamalar (aloqa ma'lumotlari, NFC narxi, oferta havolasi).
// Modul darajasida keshlanadi: sahifalar almashganda qayta so'ralmaydi.
let cache = null;
let inflight = null;

export const fetchSiteSettings = async () => {
    if (cache) return cache;
    if (!inflight) {
        inflight = api.get('public/settings/')
            .then((res) => { cache = res.data || {}; return cache; })
            .catch(() => ({}))          // sozlamasiz ham sahifa ishlashda davom etadi
            .finally(() => { inflight = null; });
    }
    return inflight;
};
