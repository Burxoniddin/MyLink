import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaCheck } from 'react-icons/fa';
import { PALETTES, PALETTE_IDS } from '../lib/palettes';

// Colour-palette picker for the classic template (shown in the editor "Sozlash"
// tab). Locked for Free tier (color_edit feature).
const ThemePicker = ({ value, onChange, locked }) => {
    const { t } = useTranslation();

    return (
        <div className="theme-picker">
            <h4 className="theme-picker-title">
                {t('theme.title')}
                {locked && <span className="theme-pro">Pro</span>}
            </h4>
            <div className="theme-swatches">
                {PALETTE_IDS.map((id) => (
                    <button
                        key={id}
                        type="button"
                        className={`theme-sw ${value === id ? 'active' : ''}`}
                        style={{ background: PALETTES[id].swatch }}
                        onClick={() => !locked && onChange(id)}
                        disabled={locked}
                        title={t(`theme.${id}`)}
                        aria-label={t(`theme.${id}`)}
                    >
                        {/* Bottom-right half shows the link/accent colour so dark
                            page backgrounds stay distinguishable at a glance. */}
                        <span
                            className="theme-sw-accent"
                            style={{ background: PALETTES[id].accent || '#6366f1' }}
                        />
                        {value === id && <FaCheck />}
                    </button>
                ))}
            </div>
            {locked && (
                <p className="theme-locked">
                    {t('theme.locked')} <Link to="/pricing">{t('limit.see_plans')}</Link>
                </p>
            )}
        </div>
    );
};

export default ThemePicker;
