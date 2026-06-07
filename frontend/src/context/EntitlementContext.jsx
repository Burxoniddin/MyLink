/* eslint-disable react-refresh/only-export-components */
// Context + colocated hooks; Fast Refresh rule disabled for this provider file.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

const EntitlementContext = createContext({
    entitlements: null,
    loading: true,
    refresh: () => {},
});

export const EntitlementProvider = ({ children }) => {
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setEntitlements(null);
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('me/');
            setEntitlements(res.data.entitlements || null);
        } catch {
            setEntitlements(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <EntitlementContext.Provider value={{ entitlements, loading, refresh }}>
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
