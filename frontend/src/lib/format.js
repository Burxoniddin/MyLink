// "25 000" — digit groups separated by a thin space (U+2009), which reads
// tighter than a full space at the small sizes the menu cards use.
export const formatPrice = (n) => {
    if (n === null || n === undefined || n === '') return '';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Bio cap for a business page — must match MAX_BIO_CHARS in businesses/models.py.
export const MAX_BIO_CHARS = 150;

// Same rule as the server: surrounding whitespace is not counted.
export const countBioChars = (s) => (s || '').trim().length;
