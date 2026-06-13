import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck } from 'react-icons/fa';
import { TEMPLATE_OPTIONS } from './templateMeta';

const MiniPreview = ({ o }) => (
    <div style={{
        height: 96, borderRadius: 10, background: o.bg, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        border: o.light ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,.08)',
    }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: o.accent }} />
        <div style={{ width: '64%', height: 8, borderRadius: 4, background: o.surface }} />
        <div style={{ width: '64%', height: 8, borderRadius: 4, background: o.surface }} />
    </div>
);

const TemplatePicker = ({ value, onChange }) => {
    const { t } = useTranslation();
    return (
        <div>
            <h2 style={{ marginBottom: 4 }}>{t('tpl.section')}</h2>
            <p style={{ color: '#6b7280', marginBottom: 18 }}>{t('tpl.desc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
                {TEMPLATE_OPTIONS.map((o) => {
                    const selected = (value || 'classic') === o.id;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => onChange(o.id)}
                            style={{
                                textAlign: 'left', cursor: 'pointer', padding: 8, borderRadius: 14,
                                background: '#fff',
                                border: selected ? `2px solid ${o.accent}` : '2px solid #e5e7eb',
                                boxShadow: selected ? `0 8px 22px -12px ${o.accent}` : 'none',
                                position: 'relative', transition: '.15s',
                            }}
                        >
                            <MiniPreview o={o} />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: '0 2px' }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{t(`tpl.${o.id}`)}</span>
                                {selected && (
                                    <span style={{
                                        width: 20, height: 20, borderRadius: '50%', background: o.accent, color: '#fff',
                                        display: 'grid', placeItems: 'center', fontSize: 10,
                                    }}><FaCheck /></span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default TemplatePicker;
