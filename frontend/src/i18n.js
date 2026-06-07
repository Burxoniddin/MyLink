import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import uz from './locales/uz/translation.json';
import ru from './locales/ru/translation.json';
import en from './locales/en/translation.json';

export const LANGUAGES = ['uz', 'ru', 'en'];

const saved = localStorage.getItem('mylink-lang');
const initial = LANGUAGES.includes(saved) ? saved : 'uz';

i18n.use(initReactI18next).init({
    resources: {
        uz: { translation: uz },
        ru: { translation: ru },
        en: { translation: en },
    },
    lng: initial,
    fallbackLng: 'uz',
    interpolation: { escapeValue: false },
});

export default i18n;
