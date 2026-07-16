import React from 'react';
import ClassicTemplate from './templates/ClassicTemplate';
import ProfileTemplate from './templates/ProfileTemplate';
import { TEMPLATE_META } from './templates/templateMeta';
import { getMediaUrl, toEmbed } from '../lib/media';
import { detectPlatform } from '../lib/linkUtils';
import { useTranslation } from 'react-i18next';

// Live phone-frame preview of the public page, rendered with the REAL
// template components from the editor's unsaved form state — switching the
// template or palette reflects instantly, before saving.
const PreviewPane = ({ formData, links = [], logoUrl = null, sections = [], verified = false, brandingRemoved = false }) => {
    const { t } = useTranslation();
    const tpl = formData.template || 'classic';

    // Shape the form state like the public API payload the templates expect.
    const data = {
        name: formData.name || t('detail.business_name'),
        description: formData.description,
        logo: logoUrl,
        template: tpl,
        theme: formData.theme,
        theme_mode: formData.theme_mode || '',
        links: links
            .filter((l) => l.url && l.url.trim() !== '')
            .map((l) => ({ ...l, icon_type: detectPlatform(l.url) })),
        media_sections: sections,
        verified,
        branding_removed: brandingRemoved,
    };

    return (
        <div className="pv-device">
            <div className="pv-notch" />
            <div className="pv-screen">
                <div className="pv-scale">
                    {tpl === 'classic' ? (
                        <ClassicTemplate
                            data={data}
                            previewMode
                            getLogoUrl={getMediaUrl}
                            toEmbed={toEmbed}
                            t={t}
                        />
                    ) : (
                        <ProfileTemplate
                            data={data}
                            tpl={tpl}
                            theme={data.theme_mode || TEMPLATE_META[tpl]?.defaultTheme || 'dark'}
                            previewMode
                            getLogoUrl={getMediaUrl}
                            toEmbed={toEmbed}
                            t={t}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PreviewPane;
