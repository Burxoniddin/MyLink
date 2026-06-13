import React from 'react';
import { Link } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher';
import '../pages/HomePage.css';
import './AuthLayout.css';

// Shared shell for Login / Register / Forgot / Reset: landing-style playful
// background (mesh + floating shapes) with a single centered card.
const AuthLayout = ({ title, subtitle, children }) => (
    <div className="lpc auth-page">
        <div className="auth-mesh"></div>
        <span className="shape c anim2" style={{ width: 130, height: 130, background: 'color-mix(in srgb,var(--coral) 70%,#fff)', left: '7%', top: '14%', opacity: .4 }}></span>
        <span className="shape sq animspin" style={{ width: 52, height: 52, background: 'var(--lime)', right: '12%', top: '18%', opacity: .45 }}></span>
        <span className="shape c anim1" style={{ width: 24, height: 24, background: 'var(--cyan)', left: '18%', bottom: '16%', opacity: .7 }}></span>
        <span className="shape c anim2" style={{ width: 72, height: 72, background: 'color-mix(in srgb,var(--violet) 36%,#fff)', right: '8%', bottom: '12%', opacity: .5 }}></span>

        <div className="auth-topbar">
            <Link className="brand" to="/"><span className="glyph"></span> Mylink</Link>
            <LanguageSwitcher />
        </div>

        <div className="auth-center">
            <div className="auth-card">
                {title && <h2 className="auth-title">{title}</h2>}
                {subtitle && <p className="auth-subtitle">{subtitle}</p>}
                {children}
            </div>
        </div>
    </div>
);

export default AuthLayout;
