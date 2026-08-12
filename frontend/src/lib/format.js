// "25 000" — digit groups separated by a thin space (U+2009), which reads
// tighter than a full space at the small sizes the menu cards use.
export const formatPrice = (n) => {
    if (n === null || n === undefined || n === '') return '';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
