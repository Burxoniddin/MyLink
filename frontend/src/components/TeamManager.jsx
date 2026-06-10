import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaUserPlus, FaTrash, FaCrown, FaLock } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import api from '../api';

const ROLES = ['admin', 'editor', 'viewer'];

const roleBadgeStyle = (role) => {
    const map = {
        owner: { bg: '#ede9fe', fg: '#5b21b6' },
        admin: { bg: '#dbeafe', fg: '#1e40af' },
        editor: { bg: '#dcfce7', fg: '#166534' },
        viewer: { bg: '#f3f4f6', fg: '#374151' },
    };
    const c = map[role] || map.viewer;
    return {
        background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600,
        padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
    };
};

const TeamManager = ({ path }) => {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [identifier, setIdentifier] = useState('');
    const [role, setRole] = useState('viewer');
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const load = useCallback(async () => {
        try {
            const res = await api.get(`businesses/${path}/members/`);
            setData(res.data);
        } catch {
            /* not owner/admin — Team tab shouldn't be visible anyway */
        } finally {
            setLoading(false);
        }
    }, [path]);

    useEffect(() => { load(); }, [load]);

    const invite = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) {
            setMsg({ type: 'error', text: t('team.err_invalid') });
            return;
        }
        setSending(true);
        setMsg({ type: '', text: '' });
        try {
            await api.post(`businesses/${path}/members/`, { identifier: identifier.trim(), role });
            setIdentifier('');
            setMsg({ type: 'success', text: t('team.invited') });
            await load();
        } catch (err) {
            const reason = err.response?.data?.reason;
            const key = {
                owner: 'team.err_owner',
                already_member: 'team.err_already_member',
                already_invited: 'team.err_already_invited',
                invalid_identifier: 'team.err_invalid',
                team: 'team.upsell',
            }[reason] || 'team.err_generic';
            setMsg({ type: 'error', text: t(key) });
        } finally {
            setSending(false);
        }
    };

    const changeRole = async (id, newRole) => {
        try {
            await api.patch(`members/${id}/`, { role: newRole });
            await load();
        } catch { /* ignore */ }
    };

    const remove = async (id) => {
        try {
            await api.delete(`members/${id}/`);
            await load();
        } catch { /* ignore */ }
    };

    if (loading) {
        return <div className="detail-loading"><div className="spinner" /></div>;
    }

    // Owner downgraded from Pro: invite disabled, existing members still listed.
    const teamEnabled = data?.team_enabled;

    return (
        <div style={{ maxWidth: 720 }}>
            <h3 style={{ margin: '0 0 4px' }}>{t('team.title')}</h3>
            <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14 }}>{t('team.desc')}</p>

            {!teamEnabled ? (
                <div style={{
                    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
                    padding: 20, textAlign: 'center', marginBottom: 24,
                }}>
                    <FaLock style={{ color: '#d97706', fontSize: 24, marginBottom: 10 }} />
                    <p style={{ margin: '0 0 14px', color: '#92400e' }}>{t('team.upsell')}</p>
                    <Link to="/pricing" className="add-btn" style={{ display: 'inline-flex' }}>
                        {t('limit.see_plans')}
                    </Link>
                </div>
            ) : (
                <form onSubmit={invite} style={{
                    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
                    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12,
                    padding: 16, marginBottom: 24,
                }}>
                    <input
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t('team.invite_ph')}
                        style={{
                            flex: '1 1 200px', padding: '10px 12px', borderRadius: 8,
                            border: '1px solid #d1d5db', fontSize: 14,
                        }}
                    />
                    <select value={role} onChange={(e) => setRole(e.target.value)}
                        style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
                        {ROLES.map((r) => (
                            <option key={r} value={r}>{t(`team.role_${r}`)}</option>
                        ))}
                    </select>
                    <button type="submit" className="add-btn" disabled={sending}>
                        <FaUserPlus /> {sending ? t('team.inviting') : t('team.invite_btn')}
                    </button>
                </form>
            )}

            {msg.text && (
                <div className={`message ${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>
            )}

            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                {t(`team.role_${role}_desc`)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Owner row */}
                <div style={rowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <FaCrown style={{ color: '#a855f7', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {data?.owner?.display}
                        </span>
                    </div>
                    <span style={roleBadgeStyle('owner')}>{t('team.owner')}</span>
                </div>

                {/* Members */}
                {(data?.members || []).map((m) => (
                    <div key={m.id} style={rowStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                                {m.display}
                            </span>
                            {m.status === 'pending' && (
                                <span style={{ ...roleBadgeStyle('viewer'), background: '#fef3c7', color: '#92400e' }}>
                                    {t('team.status_pending')}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <select
                                value={m.role}
                                onChange={(e) => changeRole(m.id, e.target.value)}
                                style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                            >
                                {ROLES.map((r) => (
                                    <option key={r} value={r}>{t(`team.role_${r}`)}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => remove(m.id)}
                                title={t('team.remove')}
                                style={{
                                    border: 'none', background: 'none', color: '#ef4444',
                                    cursor: 'pointer', padding: 6, fontSize: 15,
                                }}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ))}

                {(data?.members || []).length === 0 && (
                    <p className="blocks-empty">{t('team.no_members')}</p>
                )}
            </div>

            {data?.members?.some((m) => m.status === 'pending') && (
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 12 }}>{t('team.pending_hint')}</p>
            )}
        </div>
    );
};

const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '12px 16px', border: '1px solid #e5e7eb',
    borderRadius: 12, background: '#fff',
};

export default TeamManager;
