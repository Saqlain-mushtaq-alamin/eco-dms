import React, { useEffect, useState } from 'react'
import { listChallenges, joinChallenge, type Challenge } from '../api'

const STATUS_COLOR: Record<string, string> = {
    active: '#10b981', draft: '#6366f1', completed: '#f59e0b', cancelled: '#ef4444',
}

function ChallengeCard({ c, onJoin }: { c: Challenge; onJoin: (id: string) => void }) {
    const ends = new Date(c.ends_at)
    const daysLeft = Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000))
    const color = STATUS_COLOR[c.status] ?? '#888'

    return (
        <div className="partner-challenge-card">
            <div className="partner-challenge-header">
                <span className="partner-challenge-status" style={{ background: color }}>{c.status}</span>
                <span className="partner-challenge-category">#{c.category}</span>
            </div>
            <h3 className="partner-challenge-title">{c.title}</h3>
            <p className="partner-challenge-desc">{c.description.slice(0, 120)}{c.description.length > 120 ? '…' : ''}</p>

            <div className="partner-challenge-stats">
                <div><span>🪙</span><strong>{c.eco_prize_pool.toLocaleString()}</strong><span>ECO prize pool</span></div>
                <div><span>👥</span><strong>{c.participant_count}</strong><span>participants</span></div>
                <div><span>✅</span><strong>{c.verified_actions}</strong><span>verified actions</span></div>
                <div><span>🌿</span><strong>{c.co2_offset_kg.toFixed(1)} kg</strong><span>CO₂ offset</span></div>
            </div>

            <div className="partner-challenge-footer">
                <div className="partner-challenge-eco-split">
                    <span title="Burned (50%)">🔥 {c.burned_amount.toLocaleString()} burned</span>
                    <span title="Platform fee (10%)">🏛 {c.platform_fee.toLocaleString()} fee</span>
                    <span title="User rewards (40%)">🎁 {(c.eco_prize_pool - c.burned_amount - c.platform_fee).toLocaleString()} rewards</span>
                </div>
                {c.status === 'active' && (
                    <button
                        id={`join-challenge-${c.challenge_id}`}
                        className="partner-btn partner-btn--primary"
                        onClick={() => onJoin(c.challenge_id)}
                    >
                        Join Challenge · {daysLeft}d left
                    </button>
                )}
            </div>
        </div>
    )
}

// Demo challenges shown when API returns empty (no active Redis)
const DEMO_CHALLENGES: Challenge[] = [
    {
        challenge_id: 'demo-1', partner_id: 'p1', title: '🥾 Trail Cleanup Sprint',
        description: 'Pick up trash on local trails and post verified photos of your cleanup.',
        category: 'community_cleanup', eco_prize_pool: 15_000, burned_amount: 7_500,
        platform_fee: 1_500, participant_count: 847, verified_actions: 723,
        co2_offset_kg: 1446.0, starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 18 * 86_400_000).toISOString(), status: 'active',
    },
    {
        challenge_id: 'demo-2', partner_id: 'p2', title: '🧥 Repair, Don\'t Replace',
        description: 'Post before/after photos of clothing you\'ve repaired instead of discarding.',
        category: 'clothing_repair', eco_prize_pool: 10_000, burned_amount: 5_000,
        platform_fee: 1_000, participant_count: 512, verified_actions: 489,
        co2_offset_kg: 244.5, starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 12 * 86_400_000).toISOString(), status: 'active',
    },
    {
        challenge_id: 'demo-3', partner_id: 'p3', title: '🛒 Zero-Waste Grocery Week',
        description: 'Document a full week of zero-waste grocery shopping with reusable containers.',
        category: 'reusable_bag', eco_prize_pool: 8_000, burned_amount: 4_000,
        platform_fee: 800, participant_count: 1023, verified_actions: 911,
        co2_offset_kg: 91.1, starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), status: 'active',
    },
]

export default function ChallengesPanel() {
    const [challenges, setChallenges] = useState<Challenge[]>([])
    const [loading, setLoading]       = useState(true)
    const [filter, setFilter]         = useState<string>('all')
    const [toast, setToast]           = useState<string | null>(null)

    useEffect(() => {
        listChallenges()
            .then(data => setChallenges(data.length ? data : DEMO_CHALLENGES))
            .catch(() => setChallenges(DEMO_CHALLENGES))
            .finally(() => setLoading(false))
    }, [])

    async function handleJoin(id: string) {
        try {
            await joinChallenge(id)
            setToast('✅ Joined challenge!')
        } catch {
            setToast('⚠️ Could not join — are you signed in?')
        }
        setTimeout(() => setToast(null), 3000)
    }

    const statuses = ['all', ...Array.from(new Set(challenges.map(c => c.status)))]
    const visible  = filter === 'all' ? challenges : challenges.filter(c => c.status === filter)

    return (
        <div>
            {toast && <div className="partnership-toast">{toast}</div>}

            <div className="partner-filter-bar">
                {statuses.map(s => (
                    <button
                        key={s}
                        id={`filter-challenge-${s}`}
                        className={`partner-filter-btn${filter === s ? ' active' : ''}`}
                        onClick={() => setFilter(s)}
                    >
                        {s}
                    </button>
                ))}
                <span className="partner-filter-count">{visible.length} challenge{visible.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
                <div className="partnership-loading">Loading challenges…</div>
            ) : (
                <div className="partner-challenge-grid">
                    {visible.map(c => <ChallengeCard key={c.challenge_id} c={c} onJoin={handleJoin} />)}
                </div>
            )}
        </div>
    )
}
