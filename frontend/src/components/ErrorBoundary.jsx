import React from 'react';
import i18n from 'i18next';
import './ErrorBoundary.css';

/** Translate with a hardcoded fallback: the boundary must still read correctly
 *  when the crash happened before/inside i18n initialisation. */
const tr = (key, fallback) => {
    try {
        const v = i18n.t(key);
        return !v || v === key ? fallback : v;
    } catch {
        return fallback;
    }
};

/**
 * App-level error boundary. Without one, any render error unmounts the whole
 * React root and leaves a blank white page with no explanation — so a visitor
 * cannot tell a crash from a slow network. Class component because
 * getDerivedStateFromError/componentDidCatch have no hook equivalent.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // Keep the stack in the console — it is the only trace we get in prod.
        console.error('[MyLink] Kutilmagan xato / unhandled render error:', error, info?.componentStack);
        this.setState({ info });
    }

    render() {
        const { error, info } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="eb-wrap">
                <div className="eb-card">
                    <span className="eb-ico" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3L2.5 20h19z" />
                            <path d="M12 9.5V14M12 17v.01" />
                        </svg>
                    </span>
                    <h1>{tr('error.title', "Nimadir noto‘g‘ri ketdi")}</h1>
                    <p>{tr('error.desc', "Sahifani yangilab ko‘ring. Muammo takrorlansa, biz bilan bog‘laning.")}</p>
                    <div className="eb-actions">
                        <button type="button" className="eb-btn primary" onClick={() => window.location.reload()}>
                            {tr('error.reload', 'Sahifani yangilash')}
                        </button>
                        <a className="eb-btn ghost" href="/dashboard">
                            {tr('error.home', 'Bosh sahifaga')}
                        </a>
                    </div>
                    {import.meta.env.DEV && (
                        <details className="eb-details">
                            <summary>{tr('error.details', 'Texnik tafsilot')}</summary>
                            <pre>{String(error?.stack || error)}{info?.componentStack || ''}</pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
