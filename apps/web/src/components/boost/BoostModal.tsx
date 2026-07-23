import React, { useState } from 'react'

interface BoostTier {
    level: 1 | 2 | 3
    name: string
    cost: number         // ECO tokens
    reach: string        // "3x reach"
    duration: string     // "24 hours"
    emoji: string
    color: string
}

const TIERS: BoostTier[] = [
    { level: 1, name: 'Spark',    cost: 5,  reach: '3×',  duration: '24 hours', emoji: '✨', color: '#f59e0b' },
    { level: 2, name: 'Flame',    cost: 15, reach: '10×', duration: '48 hours', emoji: '🔥', color: '#f97316' },
    { level: 3, name: 'Wildfire', cost: 50, reach: '50×', duration: '7 days',   emoji: '⚡', color: '#ef4444' },
]

interface BoostModalProps {
    postCid: string
    onClose: () => void
    onBoost: (level: 1 | 2 | 3, cost: number) => Promise<void>
    ecoBalance?: number      // user's current ECO balance
    activeTier?: number      // 0 = not boosted
}

export function BoostModal({ postCid, onClose, onBoost, ecoBalance = 0, activeTier = 0 }: BoostModalProps) {
    const [selected, setSelected] = useState<BoostTier>(TIERS[0])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canAfford = ecoBalance >= selected.cost

    const handleBoost = async () => {
        if (!canAfford) return
        setLoading(true)
        setError(null)
        try {
            await onBoost(selected.level, selected.cost)
            onClose()
        } catch (e: any) {
            setError(e?.message ?? 'Transaction failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 8000,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff', borderRadius: 22, padding: '1.75rem',
                    maxWidth: 420, width: '100%',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>
                            ⚡ Boost Post
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
                            Burn ECO to amplify reach • All tokens permanently burned
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#f3f4f6', border: 'none', borderRadius: 8,
                        width: 30, height: 30, cursor: 'pointer', fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>×</button>
                </div>

                {/* Balance */}
                <div style={{
                    background: '#f9fafb', borderRadius: 10, padding: '0.6rem 0.85rem',
                    marginBottom: 16, display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.78rem',
                }}>
                    <span style={{ color: '#6b7280', fontWeight: 600 }}>Your ECO Balance</span>
                    <span style={{ fontWeight: 800, color: ecoBalance > 0 ? '#166534' : '#ef4444' }}>
                        {ecoBalance.toFixed(0)} ECO
                    </span>
                </div>

                {/* Active boost indicator */}
                {activeTier > 0 && (
                    <div style={{
                        background: '#fef3c7', borderRadius: 10, padding: '0.5rem 0.85rem',
                        marginBottom: 12, fontSize: '0.75rem', fontWeight: 700, color: '#92400e',
                    }}>
                        ⚡ Already boosted at {TIERS[activeTier - 1]?.name} level
                    </div>
                )}

                {/* Tier selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                    {TIERS.map(tier => {
                        const isSel = selected.level === tier.level
                        const affordable = ecoBalance >= tier.cost
                        return (
                            <button
                                key={tier.level}
                                id={`boost-tier-${tier.level}`}
                                onClick={() => setSelected(tier)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '0.85rem 1rem', borderRadius: 14, cursor: affordable ? 'pointer' : 'not-allowed',
                                    border: isSel ? `2px solid ${tier.color}` : '1.5px solid #e5e7eb',
                                    background: isSel ? `${tier.color}10` : '#fff',
                                    opacity: affordable ? 1 : 0.45,
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                }}
                            >
                                <span style={{ fontSize: '1.4rem' }}>{tier.emoji}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: tier.color }}>
                                        {tier.name}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                                        {tier.reach} reach · {tier.duration}
                                    </div>
                                </div>
                                <div style={{
                                    fontWeight: 900, fontSize: '0.85rem',
                                    color: isSel ? tier.color : '#374151',
                                }}>
                                    {tier.cost} ECO
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        background: '#fee2e2', color: '#dc2626', borderRadius: 8,
                        padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                        marginBottom: 12,
                    }}>⚠️ {error}</div>
                )}

                {/* Warning */}
                <div style={{
                    background: '#fff7ed', borderRadius: 10, padding: '0.55rem 0.85rem',
                    marginBottom: 14, fontSize: '0.7rem', color: '#92400e', fontWeight: 600,
                }}>
                    🔥 {selected.cost} ECO will be permanently burned · This action cannot be undone
                </div>

                {/* Confirm button */}
                <button
                    id="confirm-boost-btn"
                    onClick={handleBoost}
                    disabled={!canAfford || loading}
                    style={{
                        width: '100%', padding: '0.8rem', borderRadius: 14, border: 'none',
                        cursor: canAfford && !loading ? 'pointer' : 'not-allowed',
                        fontWeight: 800, fontSize: '0.9rem',
                        background: canAfford
                            ? `linear-gradient(135deg, ${selected.color}, ${selected.color}cc)`
                            : '#e5e7eb',
                        color: canAfford ? '#fff' : '#9ca3af',
                        transition: 'opacity 0.15s',
                    }}
                >
                    {loading ? 'Confirming in wallet…' : !canAfford
                        ? `Need ${selected.cost - ecoBalance} more ECO`
                        : `${selected.emoji} Boost with ${selected.cost} ECO`}
                </button>
            </div>
        </div>
    )
}
