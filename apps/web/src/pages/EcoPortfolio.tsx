import React, { useEffect, useState, useCallback } from 'react'
import { API_BASE } from '../api'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CategoryStats {
    count: number
    co2_kg: number
}

interface MonthlyAction {
    month: string
    count: number
    co2_kg: number
}

interface DayAction {
    date: string
    actions: number
    eco_type?: string
}

interface WeekData {
    week_start: string
    days: DayAction[]
    total: number
}

interface ClaimableCredential {
    id: string
    title: string
    type: string
}

interface EcoPortfolio {
    wallet: string
    username?: string
    avatar_cid?: string
    total_verified_actions: number
    verification_accuracy: number
    co2_offset_kg: number
    eco_level: number
    eco_title: string
    next_level_actions?: number
    current_streak_days: number
    longest_streak_days: number
    categories: Record<string, CategoryStats>
    votes_cast: number
    correct_votes: number
    voter_rank_percentile?: number
    monthly_actions: MonthlyAction[]
    action_graph: WeekData[]
    credentials: ClaimableCredential[]
    claimable_credentials: ClaimableCredential[]
    portfolio_url?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CO2_FORMAT = (kg: number): string => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} tons`
    return `${kg.toFixed(1)} kg`
}

const CATEGORY_ICONS: Record<string, string> = {
    transport: '🚲',
    nature:    '🌱',
    waste:     '♻️',
    energy:    '☀️',
    water:     '💧',
    other:     '🌍',
}

const CATEGORY_COLORS: Record<string, string> = {
    transport: '#22c55e',
    nature:    '#16a34a',
    waste:     '#65a30d',
    energy:    '#eab308',
    water:     '#06b6d4',
    other:     '#6b7280',
}

const CREDENTIAL_TYPE_ICONS: Record<string, string> = {
    milestone: '🏅',
    community: '🏆',
    partner:   '🤝',
    annual:    '⭐',
}

function getGraphColor(actions: number, max: number): string {
    if (actions === 0) return 'rgba(34,197,94,0.08)'
    const intensity = Math.min(actions / Math.max(max, 1), 1)
    if (intensity < 0.25) return 'rgba(34,197,94,0.25)'
    if (intensity < 0.5)  return 'rgba(34,197,94,0.45)'
    if (intensity < 0.75) return 'rgba(22,163,74,0.7)'
    return 'rgba(15,118,53,0.95)'
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
    return (
        <div className="eco-stat-card">
            <div className="eco-stat-value">{value}</div>
            <div className="eco-stat-label">{label}</div>
            {sub && <div className="eco-stat-sub">{sub}</div>}
        </div>
    )
}

function LevelBadge({ level, title }: { level: number; title: string }) {
    return (
        <div className="eco-level-badge">
            <span className="eco-level-num">L{level}</span>
            <span className="eco-level-title">{title}</span>
        </div>
    )
}

function ContributionGraph({ weeks }: { weeks: WeekData[] }) {
    const maxDaily = Math.max(...weeks.flatMap(w => w.days.map(d => d.actions)), 1)
    const [hoveredDay, setHoveredDay] = useState<{ date: string; actions: number; eco_type?: string } | null>(null)

    const monthLabels: { label: string; col: number }[] = []
    weeks.forEach((week, wi) => {
        const firstDay = week.days[0]
        if (firstDay && firstDay.date) {
            const date = new Date(firstDay.date)
            if (date.getDate() <= 7) {
                monthLabels.push({ label: date.toLocaleString('default', { month: 'short' }), col: wi })
            }
        }
    })

    return (
        <div className="eco-graph-wrapper">
            <div className="eco-graph-month-labels">
                {monthLabels.map((m, i) => (
                    <span key={i} style={{ gridColumn: m.col + 1 }} className="eco-graph-month">{m.label}</span>
                ))}
            </div>
            <div className="eco-graph-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
                {weeks.map((week, wi) =>
                    week.days.map((day, di) => (
                        <div
                            key={`${wi}-${di}`}
                            className="eco-graph-cell"
                            style={{ backgroundColor: getGraphColor(day.actions, maxDaily) }}
                            onMouseEnter={() => setHoveredDay(day)}
                            onMouseLeave={() => setHoveredDay(null)}
                            title={`${day.date}: ${day.actions} action${day.actions !== 1 ? 's' : ''}${day.eco_type ? ` (${day.eco_type.replace('_', ' ')})` : ''}`}
                        />
                    ))
                )}
            </div>
            {hoveredDay && hoveredDay.actions > 0 && (
                <div className="eco-graph-tooltip">
                    <strong>{hoveredDay.date}</strong>
                    <span>{hoveredDay.actions} eco action{hoveredDay.actions !== 1 ? 's' : ''}</span>
                    {hoveredDay.eco_type && <span className="eco-graph-tooltip-type">{hoveredDay.eco_type.replace(/_/g, ' ')}</span>}
                </div>
            )}
            <div className="eco-graph-legend">
                <span>Less</span>
                {[0.08, 0.25, 0.45, 0.7, 0.95].map((alpha, i) => (
                    <div key={i} className="eco-graph-cell eco-graph-legend-cell" style={{ backgroundColor: `rgba(34,197,94,${alpha})` }} />
                ))}
                <span>More</span>
            </div>
        </div>
    )
}

function CategoryBreakdown({ categories }: { categories: Record<string, CategoryStats> }) {
    const total = Object.values(categories).reduce((s, c) => s + c.count, 0) || 1

    return (
        <div className="eco-categories">
            {Object.entries(categories)
                .filter(([, v]) => v.count > 0)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([cat, stats]) => {
                    const pct = Math.round((stats.count / total) * 100)
                    return (
                        <div key={cat} className="eco-category-row">
                            <span className="eco-category-icon">{CATEGORY_ICONS[cat] || '🌍'}</span>
                            <div className="eco-category-info">
                                <div className="eco-category-top">
                                    <span className="eco-category-name">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                                    <span className="eco-category-count">{stats.count} actions</span>
                                </div>
                                <div className="eco-category-bar-track">
                                    <div
                                        className="eco-category-bar-fill"
                                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] || '#22c55e' }}
                                    />
                                </div>
                            </div>
                            <span className="eco-category-co2">{CO2_FORMAT(stats.co2_kg)}</span>
                        </div>
                    )
                })}
        </div>
    )
}

function MonthlyChart({ monthly }: { monthly: MonthlyAction[] }) {
    const max = Math.max(...monthly.map(m => m.count), 1)
    return (
        <div className="eco-monthly-chart">
            {monthly.map((m) => {
                const heightPct = Math.max((m.count / max) * 100, 4)
                return (
                    <div key={m.month} className="eco-monthly-col" title={`${m.month}: ${m.count} actions, ${CO2_FORMAT(m.co2_kg)}`}>
                        <div className="eco-monthly-bar" style={{ height: `${heightPct}%` }} />
                        <span className="eco-monthly-label">{m.month.slice(5)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function CredentialCard({ cred, claimable }: { cred: ClaimableCredential; claimable?: boolean }) {
    return (
        <div className={`eco-credential${claimable ? ' eco-credential--claimable' : ''}`}>
            <span className="eco-credential-icon">{CREDENTIAL_TYPE_ICONS[cred.type] || '🏅'}</span>
            <div className="eco-credential-body">
                <div className="eco-credential-title">{cred.title}</div>
                <div className="eco-credential-type">{cred.type}</div>
            </div>
            {claimable && <span className="eco-credential-badge">Ready to claim</span>}
        </div>
    )
}

function StreakDisplay({ current, longest }: { current: number; longest: number }) {
    return (
        <div className="eco-streak-row">
            <div className="eco-streak-block">
                <span className="eco-streak-fire">{current > 0 ? '🔥' : '💤'}</span>
                <div>
                    <div className="eco-streak-num">{current}d</div>
                    <div className="eco-streak-label">Current streak</div>
                </div>
            </div>
            <div className="eco-streak-divider" />
            <div className="eco-streak-block">
                <span className="eco-streak-fire">⚡</span>
                <div>
                    <div className="eco-streak-num">{longest}d</div>
                    <div className="eco-streak-label">Longest streak</div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Portfolio Page ──────────────────────────────────────────────────────

interface EcoPortfolioPageProps {
    wallet: string
    isOwnProfile?: boolean
}

export default function EcoPortfolioPage({ wallet, isOwnProfile = false }: EcoPortfolioPageProps) {
    const [portfolio, setPortfolio] = useState<EcoPortfolio | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [copied, setCopied] = useState(false)

    const fetchPortfolio = useCallback(async () => {
        if (!wallet) return
        const token = localStorage.getItem('auth_token') ?? ''
        try {
            const res = await fetch(`${API_BASE}/api/portfolio/${wallet.toLowerCase()}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setPortfolio(data)
        } catch (err) {
            console.error('Portfolio fetch error:', err)
            setError('Failed to load portfolio. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [wallet])

    useEffect(() => {
        fetchPortfolio()
    }, [fetchPortfolio])

    const handleRefresh = async () => {
        setRefreshing(true)
        const token = localStorage.getItem('auth_token') ?? ''
        try {
            await fetch(`${API_BASE}/api/portfolio/${wallet.toLowerCase()}/refresh`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            await fetchPortfolio()
        } catch (err) {
            console.error('Refresh error:', err)
        } finally {
            setRefreshing(false)
        }
    }

    const handleCopyUrl = () => {
        if (portfolio?.portfolio_url) {
            navigator.clipboard.writeText(portfolio.portfolio_url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (loading) return (
        <div className="eco-portfolio-loading">
            <div className="eco-portfolio-spinner" />
            <p>Computing your garden portfolio…</p>
        </div>
    )

    if (error) return (
        <div className="eco-portfolio-error">
            <span>🌱</span>
            <p>{error}</p>
            <button onClick={fetchPortfolio}>Try again</button>
        </div>
    )

    if (!portfolio) return null

    const verifiedPct = portfolio.votes_cast > 0
        ? Math.round((portfolio.correct_votes / portfolio.votes_cast) * 100)
        : 0

    const levelProgress = portfolio.next_level_actions != null
        ? Math.round((1 - portfolio.next_level_actions / (portfolio.total_verified_actions + portfolio.next_level_actions)) * 100)
        : 100

    return (
        <div className="eco-portfolio">
            {/* ── Hero Header ─────────────────────────────── */}
            <div className="eco-portfolio-hero">
                <div className="eco-portfolio-hero-bg" />
                <div className="eco-portfolio-hero-content">
                    <div className="eco-portfolio-identity">
                        <div className="eco-portfolio-avatar">
                            {portfolio.avatar_cid
                                ? <img src={`https://ipfs.io/ipfs/${portfolio.avatar_cid}`} alt="Avatar" />
                                : <span>{(portfolio.username || portfolio.wallet).charAt(0).toUpperCase()}</span>
                            }
                        </div>
                        <div>
                            <h1 className="eco-portfolio-name">{portfolio.username || `${portfolio.wallet.slice(0, 6)}...${portfolio.wallet.slice(-4)}`}</h1>
                            <LevelBadge level={portfolio.eco_level} title={portfolio.eco_title} />
                        </div>
                    </div>

                    {/* Level progress */}
                    {portfolio.next_level_actions != null && (
                        <div className="eco-level-progress">
                            <div className="eco-level-progress-track">
                                <div className="eco-level-progress-fill" style={{ width: `${levelProgress}%` }} />
                            </div>
                            <span>{portfolio.next_level_actions} actions to next level</span>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="eco-portfolio-actions">
                        <button
                            id="eco-copy-url-btn"
                            className={`eco-action-btn eco-action-btn--primary ${copied ? 'eco-action-btn--success' : ''}`}
                            onClick={handleCopyUrl}
                        >
                            {copied ? '✓ Copied!' : '📋 Share Portfolio'}
                        </button>
                        {isOwnProfile && (
                            <button
                                id="eco-refresh-btn"
                                className={`eco-action-btn ${refreshing ? 'eco-action-btn--loading' : ''}`}
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                {refreshing ? '⟳ Refreshing…' : '↻ Refresh'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Core Stats ──────────────────────────────── */}
            <div className="eco-portfolio-stats-grid">
                <StatCard
                    value={portfolio.total_verified_actions.toLocaleString()}
                    label="Rooted Sprouts"
                    sub="ML + community rooted"
                />
                <StatCard
                    value={CO2_FORMAT(portfolio.co2_offset_kg)}
                    label="Estimated CO₂ Offset"
                    sub="Based on EPA/DEFRA factors"
                />
                <StatCard
                    value={`${portfolio.verification_accuracy.toFixed(1)}%`}
                    label="Verification Accuracy"
                    sub={portfolio.voter_rank_percentile ? `Top ${portfolio.voter_rank_percentile}% voter` : 'Community voter'}
                />
                <StatCard
                    value={portfolio.eco_level}
                    label="Sprout Level"
                    sub={portfolio.eco_title}
                />
            </div>

            {/* ── Streak ───────────────────────────────────── */}
            <div className="eco-portfolio-section">
                <h2 className="eco-section-title">🔥 Garden Streak</h2>
                <StreakDisplay current={portfolio.current_streak_days} longest={portfolio.longest_streak_days} />
            </div>

            {/* ── Contribution Graph ───────────────────────── */}
            {portfolio.action_graph && portfolio.action_graph.length > 0 && (
                <div className="eco-portfolio-section">
                    <h2 className="eco-section-title">🗓️ Sprout Action Graph</h2>
                    <p className="eco-section-sub">Your rooted sprouts over the last 52 weeks</p>
                    <ContributionGraph weeks={portfolio.action_graph} />
                </div>
            )}

            {/* ── Monthly Chart + Category Breakdown ──────── */}
            <div className="eco-portfolio-two-col">
                {portfolio.monthly_actions && portfolio.monthly_actions.length > 0 && (
                    <div className="eco-portfolio-section">
                        <h2 className="eco-section-title">📊 Monthly Activity</h2>
                        <MonthlyChart monthly={portfolio.monthly_actions} />
                    </div>
                )}

                {portfolio.categories && Object.keys(portfolio.categories).length > 0 && (
                    <div className="eco-portfolio-section">
                        <h2 className="eco-section-title">🌿 Impact Breakdown</h2>
                        <CategoryBreakdown categories={portfolio.categories} />
                    </div>
                )}
            </div>

            {/* ── Voter Reputation ─────────────────────────── */}
            {portfolio.votes_cast > 0 && (
                <div className="eco-portfolio-section">
                    <h2 className="eco-section-title">🗳️ Verification Reputation</h2>
                    <div className="eco-voter-stats">
                        <div className="eco-voter-stat">
                            <span className="eco-voter-num">{portfolio.votes_cast.toLocaleString()}</span>
                            <span className="eco-voter-label">Votes Cast</span>
                        </div>
                        <div className="eco-voter-stat">
                            <span className="eco-voter-num">{portfolio.correct_votes.toLocaleString()}</span>
                            <span className="eco-voter-label">Correct Votes</span>
                        </div>
                        <div className="eco-voter-stat">
                            <span className="eco-voter-num eco-voter-accuracy">{verifiedPct}%</span>
                            <span className="eco-voter-label">Accuracy</span>
                        </div>
                        {portfolio.voter_rank_percentile && (
                            <div className="eco-voter-stat">
                                <span className="eco-voter-num eco-voter-rank">Top {portfolio.voter_rank_percentile}%</span>
                                <span className="eco-voter-label">Voter Rank</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Credentials ──────────────────────────────── */}
            {(portfolio.credentials.length > 0 || portfolio.claimable_credentials.length > 0) && (
                <div className="eco-portfolio-section">
                    <h2 className="eco-section-title">🏅 Verified Credentials</h2>
                    <p className="eco-section-sub">Blockchain-verified achievements — proof of real eco-action</p>
                    <div className="eco-credentials-grid">
                        {portfolio.claimable_credentials.map(cred => (
                            <CredentialCard key={`claim-${cred.id}`} cred={cred} claimable />
                        ))}
                        {portfolio.credentials.map(cred => (
                            <CredentialCard key={cred.id} cred={cred} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Empty State ───────────────────────────────── */}
            {portfolio.total_verified_actions === 0 && (
                <div className="eco-portfolio-empty">
                    <div className="eco-portfolio-empty-icon">🌱</div>
                    <h3>Start your Sproudtly Journey</h3>
                    <p>Plant your first sprout to build your garden profile. Every rooted sprout adds to your environmental credentials and Sprout tokens (SPT).</p>
                </div>
            )}
        </div>
    )
}
