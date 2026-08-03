// URL helpers shared by the editor and the live preview.
// When adding a platform: update detectPlatform here + lib/linkIcons.jsx +
// components/LinkButton.jsx + backend Link.ICON_CHOICES (businesses/models.py).

// Auto-detect platform from URL
export const detectPlatform = (url) => {
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
    if (lower.includes('steampowered.com') || lower.includes('steamcommunity.com')) return 'steam';
    if (lower.includes('behance.net')) return 'behance';
    if (lower.includes('dribbble.com')) return 'dribbble';
    if (lower.includes('twitch.tv')) return 'twitch';
    if (lower.includes('discord.gg') || lower.includes('discord.com') || lower.includes('discordapp.com')) return 'discord';
    if (lower.includes('pinterest.') || lower.includes('pin.it')) return 'pinterest';
    return 'website';
};

// Normalize URL - add https:// if missing
export const normalizeUrl = (url) => {
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
