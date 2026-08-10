import React from 'react';
import LinkButton from '../LinkButton';
import Highlights from '../Highlights';
import VerifiedBadge from '../VerifiedBadge';
import { getPalette } from '../../lib/palettes';

// The default "classic" public page layout, extracted from LandingPage so the
// editor's live preview can render the exact same markup from form state.
// `data` is the public-payload shape; in `previewMode` links don't navigate
// and clicks aren't tracked.
const ClassicTemplate = ({ data, onLinkClick = () => {}, getLogoUrl, toEmbed, t, previewMode = false }) => {
    const palette = getPalette(data.theme);
    // Owner-chosen mode; classic defaults to dark. In light mode the palette's
    // dark page background is skipped (accent still colours the buttons).
    const light = data.theme_mode === 'light';

    const linkClick = (link) => (e) => {
        if (previewMode) {
            e.preventDefault();
            return;
        }
        onLinkClick(link.title);
    };

    return (
        <div
            className={`landing-page ${light ? 'light-theme' : ''}`}
            style={!light && palette.bg ? { background: palette.bg } : undefined}
        >
            {/* Animated background — only for the default palette (others set their own bg) */}
            {(light || !palette.bg) && <div className="landing-bg-gradient"></div>}

            {/* Main content card */}
            <div className="landing-card fade-in-up">
                {/* Profile section */}
                <div className="landing-profile">
                    {/* Only show logo if it exists */}
                    {data.logo && (
                        <div className="landing-avatar-wrapper">
                            <img
                                src={getLogoUrl(data.logo)}
                                alt={data.name}
                                className="landing-avatar"
                            />
                            <div className="landing-avatar-ring"></div>
                        </div>
                    )}

                    <h1 className="landing-title">
                        {data.name}
                        {data.verified && <VerifiedBadge />}
                    </h1>

                    {data.description && (
                        <p className="landing-bio">{data.description}</p>
                    )}
                </div>

                {/* Media sections — cover-card carousel under the bio, above the links */}
                <Highlights sections={data.media_sections} getMediaUrl={getLogoUrl} toEmbed={toEmbed} />

                {/* Links section */}
                <div className="landing-links">
                    {data.links && data.links.map((link, index) => (
                        <LinkButton
                            key={link.id ?? index}
                            link={link}
                            index={index}
                            accent={palette.accent}
                            onClick={linkClick(link)}
                        />
                    ))}
                </div>

                {/* Empty state */}
                {(!data.links || data.links.length === 0) && (!data.media_sections || data.media_sections.length === 0) && (
                    <div className="landing-empty">
                        <div className="empty-icon">🔗</div>
                        <p>{t('landing.no_links')}</p>
                    </div>
                )}

                {/* Footer — hidden for paid tiers (branding_removed) */}
                {!data.branding_removed && (
                    <div className="landing-branding">
                        <a href="https://mylink.asia" target="_blank" rel="noopener noreferrer" className="landing-branding-link">
                            <span className="powered-text">{t('landing.powered_by')}</span>
                            <img src="/brand/appicon-192.png" alt="MyLink" className="landing-brand-logo" />
                            <strong>MyLink</strong>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassicTemplate;
