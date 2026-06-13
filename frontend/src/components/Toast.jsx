/* eslint-disable react-refresh/only-export-components */
// Global toast notifications: fixed top-right stack, slide-in, auto-dismiss.
// Usage: const toast = useToast(); toast.success('Saqlandi'); toast.error('Xato');
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const ToastContext = createContext(null);

const ICONS = {
    success: <FaCheckCircle />,
    error: <FaExclamationCircle />,
    info: <FaInfoCircle />,
};

const AUTO_DISMISS_MS = 4000;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => {
        // Mark as leaving first so the exit animation plays, then drop it.
        setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 220);
    }, []);

    const push = useCallback((type, text) => {
        if (!text) return;
        const id = ++idRef.current;
        setToasts((list) => [...list.slice(-4), { id, type, text }]);
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    }, [dismiss]);

    const api = {
        success: (text) => push('success', text),
        error: (text) => push('error', text),
        info: (text) => push('info', text),
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}${t.leaving ? ' toast-leave' : ''}`}>
                        <span className="toast-icon">{ICONS[t.type]}</span>
                        <span className="toast-text">{t.text}</span>
                        <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="close">
                            <FaTimes />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    // No-op fallback keeps callers safe if a page renders outside the provider.
    return ctx || { success: () => {}, error: () => {}, info: () => {} };
};

export default ToastContext;
