// Media URL helpers shared by the public page and the editor's live preview.

// Backend base URL for media files - auto detect based on environment
export const MEDIA_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://api.mylink.asia';

// Absolute URL for an uploaded media path (logo, block image/video, cover).
export const getMediaUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
        return path;
    }
    return `${MEDIA_BASE_URL}${path}`;
};

// Convert a YouTube watch/short URL to an embeddable URL; pass others through.
export const toEmbed = (url) => {
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    return yt ? `https://www.youtube.com/embed/${yt[1]}` : url;
};
