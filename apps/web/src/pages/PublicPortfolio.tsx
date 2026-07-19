import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StreakBadge } from '../components/portfolio/StreakBadge'
import { LevelProgress } from '../components/portfolio/LevelProgress'
import { CategoryBreakdown } from '../components/portfolio/CategoryBreakdown'
import { ActionGraph } from '../components/portfolio/ActionGraph'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Portfolio {
    wallet: string
    username?: string
    avatar_url?: string
    bio?: string
    eco_level: number
    eco_title: string
    unlocks: string
    next_level: number
    actions_to_next: number
    co2_to_next: number
    actions_progress_pct: number
    co2_progress_pct: number
    total_verified_actions: number
    co2_offset_kg: number
    current_streak_days: number
    longest_streak_days: number
    last_active_date?: string
    is_active_today: boolean
    streak_at_risk: boolean
    weekly_completion: number
    co2_by_group: Record<string, number>
    action_graph?: {
        weeks: any[]
        month_labels: any[]
        total_active_days: number
        total_posts: number
        peak_day_count: number
    }
    credentials?: Array<{
        title: string
        credential_type: string
        earned_at: string
        metadata_cid?: string
    }>
    verification_accuracy?: number
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
            borderRadius: 16, padding: '1rem 1.25rem',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#111827', lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, marginTop: 3 }}>{label}</div>
            {sub && <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
        </div>
    )
}

export default function PublicPortfolio() {
    const { address } = useParams<{ address: string }>()
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!address) return
        setLoading(true)
        fetch(`${API_BASE}/api/portfolio/${address}`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.json()
            })
            .then(setPortfolio)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [address])

    const handleShare = () => {
        const url = window.location.href
        if (navigator.share) {
            navigator.share({ title: `${portfolio?.username ?? address}'s Eco Portfolio`, url })
        } else {
            navigator.clipboard.writeText(url)
            alert('Portfolio URL copied to clipboard!')
        }
    }

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading portfolio…</div>
        </div>
    )

    if (error || !portfolio) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem' }}>🌱</div>
                <div style={{ color: '#6b7280', marginTop: 8 }}>Portfolio not found for {address?.slice(0, 8)}…</div>
            </div>
        </div>
    )

    const treesEq = Math.round(portfolio.co2_offset_kg / 21)
    const carKmEq = Math.round(portfolio.co2_offset_kg / 0.18)

    return (
        <div style={{
            minHeight: '100vh', fontFamily: 'Inter, sans-serif',
            background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 50%, #f8fafc 100%)',
        }}>
            {/* Header banner */}
            <div style={{
                background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)',
                padding: '2.5rem 1.5rem 4rem',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    opacity: 0.5,
                }} />
                <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {portfolio.avatar_url ? (
                                <img src={portfolio.avatar_url} alt="avatar"
                                    style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', objectFit: 'cover' }} />
                            ) : (
                                <div style={{
                                    width: 72, height: 72, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.2)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2rem', border: '3px solid rgba(255,255,255,0.3)',
                                }}>🌱</div>
                            )}
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                                    {portfolio.username ?? `${address?.slice(0, 6)}…${address?.slice(-4)}`}
                                </h1>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginTop: 3, fontFamily: 'monospace' }}>
                                    {address?.slice(0, 10)}…{address?.slice(-6)}
                                </div>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    marginTop: 6, padding: '3px 10px', borderRadius: 20,
                                    background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                                }}>
                                    <span style={{ color: '#86efac', fontSize: '0.75rem', fontWeight: 700 }}>
                                        Level {portfolio.eco_level} · {portfolio.eco_title}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            id="share-portfolio-btn"
                            onClick={handleShare}
                            style={{
                                padding: '0.55rem 1.1rem', borderRadius: 10,
                                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                                color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            📤 Share Portfolio
                        </button>
                    </div>
                    {portfolio.bio && (
                        <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: 12, fontSize: '0.87rem', lineHeight: 1.6 }}>
                            {portfolio.bio}
                        </p>
                    )}
                </div>
            </div>

            {/* Main content */}
            <div style={{ maxWidth: 760, margin: '-2.5rem auto 0', padding: '0 1rem 3rem', position: 'relative', zIndex: 1 }}>
                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <StatCard
                        label="Verified Actions"
                        value={portfolio.total_verified_actions.toString()}
                    />
                    <StatCard
                        label="CO₂ Offset"
                        value={portfolio.co2_offset_kg >= 1000
                            ? `${(portfolio.co2_offset_kg / 1000).toFixed(1)}t`
                            : `${portfolio.co2_offset_kg.toFixed(0)} kg`}
                        sub="CO₂ equivalent"
                    />
                    <StatCard
                        label="Trees Equivalent"
                        value={`🌳 ${treesEq}`}
                        sub="per year absorbed"
                    />
                    <StatCard
                        label="Car km Avoided"
                        value={`🚗 ${carKmEq >= 1000 ? `${(carKmEq / 1000).toFixed(0)}k` : carKmEq}`}
                        sub="vs driving"
                    />
                </div>

                {/* Streak + Level row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20 }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                        borderRadius: 16, padding: '1.25rem',
                        border: '1px solid rgba(0,0,0,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <StreakBadge
                            currentStreak={portfolio.current_streak_days}
                            longestStreak={portfolio.longest_streak_days}
                            isActiveToday={portfolio.is_active_today}
                            streakAtRisk={portfolio.streak_at_risk}
                            weeklyCompletion={portfolio.weekly_completion}
                            size="lg"
                        />
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                        borderRadius: 16, padding: '1.25rem',
                        border: '1px solid rgba(0,0,0,0.07)',
                    }}>
                        <LevelProgress levelData={{
                            level: portfolio.eco_level,
                            title: portfolio.eco_title,
                            unlocks: portfolio.unlocks,
                            next_level: portfolio.next_level,
                            actions_to_next: portfolio.actions_to_next,
                            co2_to_next: portfolio.co2_to_next,
                            actions_progress_pct: portfolio.actions_progress_pct,
                            co2_progress_pct: portfolio.co2_progress_pct,
                        }} />
                    </div>
                </div>

                {/* Action graph */}
                {portfolio.action_graph && (
                    <div style={{
                        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                        borderRadius: 16, padding: '1.5rem',
                        border: '1px solid rgba(0,0,0,0.07)', marginBottom: 20,
                    }}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                            📅 52-Week Eco Activity
                        </h3>
                        <ActionGraph
                            weeks={portfolio.action_graph.weeks}
                            monthLabels={portfolio.action_graph.month_labels}
                            totalActiveDays={portfolio.action_graph.total_active_days}
                            totalPosts={portfolio.action_graph.total_posts}
                            peakDayCount={portfolio.action_graph.peak_day_count}
                        />
                    </div>
                )}

                {/* CO₂ breakdown */}
                {portfolio.co2_by_group && Object.keys(portfolio.co2_by_group).length > 0 && (
                    <div style={{
                        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                        borderRadius: 16, padding: '1.5rem',
                        border: '1px solid rgba(0,0,0,0.07)', marginBottom: 20,
                    }}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                            🌍 Impact by Category
                        </h3>
                        <CategoryBreakdown
                            byGroup={portfolio.co2_by_group}
                            totalKg={portfolio.co2_offset_kg}
                        />
                    </div>
                )}

                {/* Credentials */}
                {portfolio.credentials && portfolio.credentials.length > 0 && (
                    <div style={{
                        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                        borderRadius: 16, padding: '1.5rem',
                        border: '1px solid rgba(0,0,0,0.07)',
                    }}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                            🏅 On-Chain Credentials
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                            {portfolio.credentials.map((cred, i) => (
                                <div key={i} style={{
                                    padding: '0.85rem', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                                    border: '1px solid rgba(34,197,94,0.2)',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>
                                        {cred.credential_type === 'milestone' ? '🏆'
                                            : cred.credential_type === 'community' ? '🤝'
                                            : cred.credential_type === 'annual' ? '🌟' : '🎖️'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>
                                        {cred.title}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 3 }}>
                                        {new Date(cred.earned_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer proof */}
                <div style={{
                    marginTop: 24, textAlign: 'center',
                    fontSize: '0.72rem', color: '#9ca3af',
                }}>
                    🔗 All actions verified by ML + community consensus on-chain ·{' '}
                    Powered by <strong style={{ color: '#166534' }}>EcoDMS</strong>
                </div>
            </div>
        </div>
    )
}
