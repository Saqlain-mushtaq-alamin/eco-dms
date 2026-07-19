import React, { useEffect, useState, useCallback } from 'react'

const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/fraud'

// ── Types ─────────────────────────────────────────────────────
interface FraudEntry {
    post_cid: string
    wallet: string
    fraud_score: number
    reasons: string[]
    flagged_at: number
    status: 'pending' | 'approved' | 'rejected' | 'escalated'
    blocked: boolean
    details: {
        duplicate?: { is_duplicate: boolean; matched_post?: string }
        exif?: { has_gps: boolean; camera_model?: string; reason: string }
        temporal?: { burst_detected: boolean; posts_today: number }
        ai_detection?: { is_ai_generated: boolean; confidence: number; signals: string[] }
        impact?: { value: number; tier: string; multiplier: number }
    }
    reviewed_by?: string
    reviewed_at?: number
    review_reason?: string
}

interface Stats {
    queue: { pending: number; approved: number; rejected: number; escalated: number }
    blocked_total: number
    pipeline: Record<string, number>
}

// ── Score badge ───────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
    const color = score >= 60 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#22c55e'
    return (
        <span style={{
            background: color + '20', color, border: `1px solid ${color}40`,
            borderRadius: 6, padding: '2px 8px', fontWeight: 800, fontSize: '0.78rem',
        }}>{score}</span>
    )
}

// ── Status pill ───────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', escalated: '#8b5cf6'
    }
    const c = map[status] ?? '#6b7280'
    return (
        <span style={{
            background: c + '18', color: c, border: `1px solid ${c}30`,
            borderRadius: 99, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
        }}>{status}</span>
    )
}

// ── Signal tags ───────────────────────────────────────────────
function SignalTags({ entry }: { entry: FraudEntry }) {
    const tags: { label: string; color: string }[] = []
    if (entry.details.duplicate?.is_duplicate) tags.push({ label: '♻️ Duplicate', color: '#ef4444' })
    if (entry.details.ai_detection?.is_ai_generated) tags.push({ label: '🤖 AI-Generated', color: '#dc2626' })
    if (entry.details.exif?.reason && entry.details.exif.reason.includes('suspicious'))
        tags.push({ label: '📷 EXIF Suspicious', color: '#f59e0b' })
    if (entry.details.temporal?.burst_detected) tags.push({ label: '⚡ Burst', color: '#f97316' })
    if (entry.details.impact) tags.push({
        label: `📊 Impact: ${entry.details.impact.tier}`, color: '#3b82f6'
    })
    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {tags.map((t, i) => (
                <span key={i} style={{
                    background: t.color + '12', color: t.color,
                    border: `1px solid ${t.color}25`, borderRadius: 4,
                    padding: '1px 6px', fontSize: '0.67rem', fontWeight: 700,
                }}>{t.label}</span>
            ))}
        </div>
    )
}

// ── Review modal ──────────────────────────────────────────────
function ReviewModal({ entry, onClose, onSubmit }: {
    entry: FraudEntry
    onClose: () => void
    onSubmit: (action: string, reason: string) => void
}) {
    const [action, setAction] = useState<'approve' | 'reject' | 'escalate'>('approve')
    const [reason, setReason] = useState('')

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 20, padding: '1.75rem',
                maxWidth: 500, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800 }}>
                    Review Flagged Post
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                    {entry.post_cid}
                </p>

                {/* Signals summary */}
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '0.85rem', marginBottom: 16 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, color: '#374151' }}>
                        Fraud Score: <ScoreBadge score={entry.fraud_score} />
                    </div>
                    {entry.reasons.map((r, i) => (
                        <div key={i} style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 3 }}>
                            • {r}
                        </div>
                    ))}
                </div>

                {/* Action picker */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {(['approve', 'reject', 'escalate'] as const).map(a => (
                        <button key={a} onClick={() => setAction(a)} style={{
                            flex: 1, padding: '0.55rem', borderRadius: 10, cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.8rem',
                            border: action === a ? '2px solid #166534' : '1.5px solid #e5e7eb',
                            background: action === a ? '#f0fdf4' : '#fff',
                            color: action === a ? '#166534' : '#374151',
                        }}>{a.charAt(0).toUpperCase() + a.slice(1)}</button>
                    ))}
                </div>

                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Review reason (optional)…"
                    rows={3}
                    style={{
                        width: '100%', borderRadius: 10, border: '1.5px solid #e5e7eb',
                        padding: '0.6rem', fontSize: '0.82rem', resize: 'vertical',
                        fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '0.65rem', borderRadius: 10, cursor: 'pointer',
                        border: '1.5px solid #e5e7eb', background: '#fff',
                        fontWeight: 700, fontSize: '0.82rem', color: '#374151',
                    }}>Cancel</button>
                    <button
                        id={`submit-review-${action}`}
                        onClick={() => onSubmit(action, reason)}
                        style={{
                            flex: 2, padding: '0.65rem', borderRadius: 10, cursor: 'pointer',
                            border: 'none', fontWeight: 800, fontSize: '0.82rem',
                            background: action === 'approve' ? '#22c55e' : action === 'reject' ? '#ef4444' : '#8b5cf6',
                            color: '#fff',
                        }}>
                        Submit {action.charAt(0).toUpperCase() + action.slice(1)}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminFraudDashboard() {
    const [tab, setTab] = useState<'queue' | 'blocked' | 'stats'>('queue')
    const [entries, setEntries] = useState<FraudEntry[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<FraudEntry | null>(null)
    const [statusFilter, setStatusFilter] = useState('pending')
    const [toast, setToast] = useState<string | null>(null)

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    const load = useCallback(async () => {
        setLoading(true)
        try {
            if (tab === 'stats') {
                const r = await fetch(`${API}/stats`, { credentials: 'include' })
                if (r.ok) setStats(await r.json())
            } else {
                const endpoint = tab === 'blocked'
                    ? `${API}/blocked?limit=100`
                    : `${API}/queue?status=${statusFilter}&limit=100`
                const r = await fetch(endpoint, { credentials: 'include' })
                if (r.ok) {
                    const d = await r.json()
                    setEntries(d.items ?? [])
                } else if (r.status === 403) {
                    setEntries([])
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [tab, statusFilter])

    useEffect(() => { load() }, [load])

    const submitReview = async (action: string, reason: string) => {
        if (!selected) return
        try {
            const r = await fetch(`${API}/review/${selected.post_cid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action, reason }),
            })
            if (r.ok) {
                showToast(`✅ ${selected.post_cid.slice(0, 10)}… ${action}d`)
                setSelected(null)
                load()
            } else {
                const err = await r.json()
                showToast(`❌ ${err.detail ?? 'Review failed'}`)
            }
        } catch (e) {
            showToast('❌ Network error')
        }
    }

    const TABS = [
        { key: 'queue', label: '📋 Review Queue' },
        { key: 'blocked', label: '🚫 Blocked' },
        { key: 'stats', label: '📊 Stats' },
    ] as const

    return (
        <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#f8fafc' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 16, right: 16, zIndex: 9999,
                    background: '#111827', color: '#fff', borderRadius: 12,
                    padding: '0.75rem 1.25rem', fontSize: '0.85rem', fontWeight: 700,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}>{toast}</div>
            )}

            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #111827, #1f2937)',
                padding: '1.5rem 2rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
                <h1 style={{ color: '#fff', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    🛡️ Fraud Review Dashboard
                </h1>
                <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: '0.78rem' }}>
                    Admin-only · Real-time fraud pipeline monitoring
                </p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: 4, padding: '1rem 2rem 0',
                borderBottom: '1px solid #e5e7eb', background: '#fff',
            }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '0.55rem 1rem', borderRadius: '10px 10px 0 0',
                        border: 'none', cursor: 'pointer', fontWeight: 700,
                        fontSize: '0.82rem',
                        background: tab === t.key ? '#f0fdf4' : 'transparent',
                        color: tab === t.key ? '#166534' : '#6b7280',
                        borderBottom: tab === t.key ? '2px solid #22c55e' : '2px solid transparent',
                    }}>{t.label}</button>
                ))}
            </div>

            <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>

                {/* ── STATS TAB ── */}
                {tab === 'stats' && stats && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                            {[
                                { label: 'Pending Review', value: stats.queue.pending, color: '#f59e0b' },
                                { label: 'Approved', value: stats.queue.approved, color: '#22c55e' },
                                { label: 'Rejected', value: stats.queue.rejected, color: '#ef4444' },
                                { label: 'Auto-Blocked', value: stats.blocked_total, color: '#dc2626' },
                            ].map(s => (
                                <div key={s.label} style={{
                                    background: '#fff', borderRadius: 14,
                                    padding: '1.1rem 1.25rem',
                                    border: `1.5px solid ${s.color}25`,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                }}>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800, color: '#111827' }}>
                                Pipeline Event Counters
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                {Object.entries(stats.pipeline).map(([k, v]) => (
                                    <div key={k} style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        padding: '0.5rem 0.75rem', background: '#f9fafb',
                                        borderRadius: 8, fontSize: '0.78rem',
                                    }}>
                                        <span style={{ color: '#374151', fontWeight: 600 }}>
                                            {k.replace(/_/g, ' ')}
                                        </span>
                                        <span style={{ fontWeight: 800, color: '#111827' }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── QUEUE / BLOCKED TABS ── */}
                {(tab === 'queue' || tab === 'blocked') && (
                    <>
                        {tab === 'queue' && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                {['pending', 'approved', 'rejected', 'escalated', 'all'].map(s => (
                                    <button key={s} onClick={() => setStatusFilter(s)} style={{
                                        padding: '0.4rem 0.9rem', borderRadius: 99, cursor: 'pointer',
                                        fontWeight: 700, fontSize: '0.75rem',
                                        border: statusFilter === s ? '2px solid #166534' : '1.5px solid #e5e7eb',
                                        background: statusFilter === s ? '#f0fdf4' : '#fff',
                                        color: statusFilter === s ? '#166534' : '#6b7280',
                                    }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                                ))}
                                <button onClick={load} style={{
                                    marginLeft: 'auto', padding: '0.4rem 0.9rem', borderRadius: 99,
                                    border: '1.5px solid #e5e7eb', background: '#fff',
                                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#374151',
                                }}>🔄 Refresh</button>
                            </div>
                        )}

                        {loading && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                Loading…
                            </div>
                        )}

                        {!loading && entries.length === 0 && (
                            <div style={{
                                textAlign: 'center', padding: '3rem',
                                color: '#9ca3af', background: '#fff',
                                borderRadius: 16, border: '1px solid #e5e7eb',
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                                <div style={{ fontWeight: 700 }}>No items in this view</div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {entries.map(entry => (
                                <div key={entry.post_cid} style={{
                                    background: '#fff', borderRadius: 14,
                                    border: `1.5px solid ${entry.blocked ? '#fecaca' : '#e5e7eb'}`,
                                    padding: '1rem 1.25rem',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                <ScoreBadge score={entry.fraud_score} />
                                                <StatusPill status={entry.status} />
                                                {entry.blocked && (
                                                    <span style={{
                                                        background: '#fee2e2', color: '#dc2626',
                                                        borderRadius: 4, padding: '1px 6px',
                                                        fontSize: '0.67rem', fontWeight: 800,
                                                    }}>AUTO-BLOCKED</span>
                                                )}
                                            </div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#374151', marginTop: 4 }}>
                                                {entry.post_cid.slice(0, 20)}…
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                                                {entry.wallet.slice(0, 10)}… · {new Date(entry.flagged_at * 1000).toLocaleString()}
                                            </div>
                                            <SignalTags entry={entry} />
                                            {entry.reasons.length > 0 && (
                                                <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#6b7280' }}>
                                                    {entry.reasons[0]}{entry.reasons.length > 1 ? ` +${entry.reasons.length - 1} more` : ''}
                                                </div>
                                            )}
                                        </div>

                                        {entry.status === 'pending' && (
                                            <button
                                                id={`review-btn-${entry.post_cid.slice(0, 8)}`}
                                                onClick={() => setSelected(entry)}
                                                style={{
                                                    padding: '0.5rem 1rem', borderRadius: 10,
                                                    border: '1.5px solid #166534', background: '#f0fdf4',
                                                    color: '#166534', fontWeight: 700,
                                                    fontSize: '0.78rem', cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                Review →
                                            </button>
                                        )}

                                        {entry.reviewed_by && (
                                            <div style={{ fontSize: '0.67rem', color: '#9ca3af', textAlign: 'right' }}>
                                                By {entry.reviewed_by.slice(0, 8)}…<br />
                                                {entry.reviewed_at ? new Date(entry.reviewed_at * 1000).toLocaleDateString() : ''}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {selected && (
                <ReviewModal
                    entry={selected}
                    onClose={() => setSelected(null)}
                    onSubmit={submitReview}
                />
            )}
        </div>
    )
}
