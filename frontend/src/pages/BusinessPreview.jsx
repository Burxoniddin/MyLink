import React from 'react';
import { useOutletContext } from 'react-router-dom';
import LinkButton from '../components/LinkButton';
import { FaLink } from 'react-icons/fa';

const BusinessPreview = () => {
    const { business } = useOutletContext();

    if (!business) {
        return (
            <div className="preview-empty">
                <div className="preview-empty-icon">📋</div>
                <h3>No Business Yet</h3>
                <p>Go to "Edit" tab to create your first business link page.</p>
            </div>
        );
    }

    return (
        <div className="preview-container">
            <div className="preview-phone">
                <div className="preview-content">
                    {/* Logo */}
                    {business.logo ? (
                        <img
                            src={business.logo}
                            alt={business.name}
                            className="preview-logo"
                        />
                    ) : (
                        <div className="preview-logo-placeholder">
                            🏢
                        </div>
                    )}

                    {/* Name */}
                    <h2 className="preview-name">{business.name}</h2>

                    {/* Description */}
                    {business.description && (
                        <p className="preview-description">{business.description}</p>
                    )}

                    {/* Links */}
                    <div className="preview-links">
                        {business.links && business.links.map((link, index) => (
                            <LinkButton key={link.id} link={link} index={index} />
                        ))}
                    </div>

                    {/* Empty links state */}
                    {(!business.links || business.links.length === 0) && (
                        <div className="preview-empty-links">
                            <FaLink />
                            <p>No links yet. Add some in the Edit tab!</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="preview-footer">
                        <span className="powered-text">Powered by</span>
                        <img src="/logo.png" alt="MyLink" className="footer-brand-logo" />
                        <strong>MyLink</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessPreview;
