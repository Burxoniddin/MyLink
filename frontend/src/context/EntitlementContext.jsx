/* eslint-disable react-refresh/only-export-components */
// Context + colocated hooks; Fast Refresh rule disabled for this provider file.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

const EntitlementContext = createContext({
    entitlements: null,
    me: null,
    loading: true,
    refresh: () => {},
});

export const EntitlementProvider = ({ children }) => {
    const [entitlements, setEntitlements] = useState(null);
    const [me, setMe] = useState(null); // /api/me/ payload (full_name, email, ...)
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setEntitlements(null);
            setMe(null);
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('me/');
            setEntitlements(res.data.entitlements || null);
            setMe(res.data);
        } catch {
            setEntitlements(null);
            setMe(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        // Re-fetch when the tab regains focus so admin-side plan/feature changes
        // (or a new subscription) show up without a full reload.
        const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onFocus);
        window.addEventListener('focus', onFocus);
        return () => {
            document.removeEventListener('visibilitychange', onFocus);
            window.removeEventListener('focus', onFocus);
        };
    }, [refresh]);

    return (
        <EntitlementContext.Provider value={{ entitlements, me, loading, refresh }}>
            {children}
        </EntitlementContext.Provider>
    );
};

// Convenience hooks
export const useEntitlements = () => useContext(EntitlementContext);

export const useFeature = (key) => {
    const { entitlements } = useContext(EntitlementContext);
    return entitlements?.features?.[key];
};

export default EntitlementContext;
