// "25 000" — thousands separated by spaces (same idiom as Pricing's headline).
export const formatPrice = (n) => {
    if (n === null || n === undefined || n === '') return '';
    return Number(n).toLocaleString('en-US').replace(/,/g, ' ');
};
