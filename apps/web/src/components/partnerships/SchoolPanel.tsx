import React, { useState } from 'react'
import { generateEcoTranscript, type EcoTranscript } from '../../api'

const SCHOOL_PLANS = [
    { id: 'free',     price: '$0',     students: '≤30',      features: ['Basic challenge', 'Student portfolios'] },
    { id: 'school',   price: '$50/mo', students: '≤500',     features: ['Dashboard', 'Eco-transcripts', 'Leaderboard'], popular: true },
    { id: 'district', price: '$200/mo', students: 'Unlimited', features: ['Multi-school', 'District leaderboard', 'API'] },
]

const DEMO_SCHOOL = {
    school_name: 'Portland High School', plan: 'school',
    enrolled_students: 234, active_this_month: 178, verified_actions: 2345,
    co2_offset_kg: 4123, school_rank: 3,
    class_leaderboard: [
        { class_name: "Ms. Chen's Biology",               actions: 456 },
        { class_name: "Mr. Park's Environmental Science", actions: 398 },
        { class_name: "Mrs. Davis' Chemistry",            actions: 234 },
    ],
}

const ACTION_ICONS: Record<string, string> = {
    tree_planting: '🌱', recycling: '♻️', cycling_commute: '🚲',
    community_cleanup: '🧹', eco_education: '📚',
}

function TranscriptView({ t }: { t: EcoTranscript }) {
    return (
        <div className="eco-transcript">
            <div className="eco-transcript-header">
                <h3>📜 ECO-TRANSCRIPT</h3>
                <div className="eco-transcript-meta">
                    <div><strong>Student:</strong> {t.student_name ?? t.student_wallet.slice(0, 10) + '…'}</div>
                    <div><strong>School:</strong> {t.school_name}</div>
                    <div><strong>Period:</strong> {t.period_start} – {t.period_end}</div>
                    <div><strong>Verification:</strong> Blockchain-verified (EcoDMS Network)</div>
                </div>
            </div>

            <div className="eco-transcript-section">
                <h4>ENVIRONMENTAL ACTION SUMMARY</h4>
                <div className="eco-transcript-stats">
                    <div><span>📋</span><strong>{t.total_verified_actions}</strong><small>Total verified actions</small></div>
                    <div><span>⏱</span><strong>{t.community_service_hours} hrs</strong><small>Community service equiv.</small></div>
                    <div><span>🌿</span><strong>{t.co2_offset_kg.toFixed(1)} kg</strong><small>CO₂ offset</small></div>
                </div>
            </div>

            <div className="eco-transcript-section">
                <h4>ACTION BREAKDOWN</h4>
                {Object.entries(t.action_breakdown).map(([cat, count]) => (
                    <div key={cat} className="eco-transcript-row">
                        <span>{ACTION_ICONS[cat] ?? '🌍'}</span>
                        <span className="eco-transcript-cat">{cat.replace(/_/g, ' ')}</span>
                        <span className="eco-transcript-count">{count} actions</span>
                    </div>
                ))}
            </div>

            {t.credentials_earned.length > 0 && (
                <div className="eco-transcript-section">
                    <h4>CREDENTIALS EARNED</h4>
                    {t.credentials_earned.map(c => (
                        <div key={c} className="eco-transcript-credential">🏅 {c}</div>
                    ))}
                </div>
            )}

            <div className="eco-transcript-section eco-transcript-verify">
                <h4>VERIFICATION</h4>
                <p>All actions verified by ML (≥93% confidence) and community consensus voting (≥95% agreement).</p>
                {t.on_chain_proof_url && (
                    <a href={t.on_chain_proof_url} id="eco-transcript-proof-link" target="_blank" rel="noreferrer" className="partner-btn partner-btn--ghost">
                        🔗 View On-Chain Proof
                    </a>
                )}
            </div>
        </div>
    )
}

export default function SchoolPanel() {
    const s = DEMO_SCHOOL
    const [walletInput, setWalletInput] = useState('0xStudentWallet123')
    const [transcript, setTranscript]   = useState<EcoTranscript | null>(null)
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState<string | null>(null)

    async function handleGenerateTranscript() {
        setLoading(true); setError(null)
        try {
            const t = await generateEcoTranscript({
                partner_id: 'demo-school', student_wallet: walletInput,
                period_start: '2025-09-01', period_end: '2026-06-30',
            })
            setTranscript(t)
        } catch {
            // Demo fallback
            setTranscript({
                transcript_id: 'demo-t', student_wallet: walletInput, school_name: 'Portland High School',
                period_start: '2025-09-01', period_end: '2026-06-30',
                total_verified_actions: 156, community_service_hours: 78, co2_offset_kg: 1234,
                action_breakdown: { tree_planting: 23, recycling: 45, cycling_commute: 67, community_cleanup: 12, eco_education: 9 },
                credentials_earned: ['Green Student', '30-Day Eco Streak'],
                on_chain_proof_url: 'https://ecodms.app/verify/transcript/demo',
                generated_at: new Date().toISOString(),
            })
        } finally { setLoading(false) }
    }

    return (
        <div>
            {/* plan cards */}
            <div className="esg-plan-grid">
                {SCHOOL_PLANS.map(p => (
                    <div key={p.id} className={`esg-plan-card${p.popular ? ' esg-plan-card--popular' : ''}`}>
                        {p.popular && <div className="esg-popular-badge">Most Popular</div>}
                        <h3 style={{ textTransform: 'capitalize' }}>{p.id}</h3>
                        <div className="esg-plan-price">{p.price}</div>
                        <div className="esg-plan-detail">👩‍🎓 {p.students} students</div>
                        <ul className="esg-plan-features">{p.features.map(f => <li key={f}>✓ {f}</li>)}</ul>
                        <button id={`school-select-${p.id}`} className="partner-btn partner-btn--outline">Get Started</button>
                    </div>
                ))}
            </div>

            {/* school dashboard demo */}
            <div className="esg-dashboard-demo">
                <h2>🏫 School Eco Dashboard — {s.school_name}</h2>
                <div className="esg-kpi-row">
                    <div className="esg-kpi"><span>👩‍🎓</span><strong>{s.enrolled_students}</strong><small>enrolled</small></div>
                    <div className="esg-kpi"><span>⚡</span><strong>{s.active_this_month}</strong><small>active this month</small></div>
                    <div className="esg-kpi"><span>✅</span><strong>{s.verified_actions.toLocaleString()}</strong><small>verified actions</small></div>
                    <div className="esg-kpi"><span>🌿</span><strong>{s.co2_offset_kg.toLocaleString()} kg</strong><small>CO₂ offset</small></div>
                    <div className="esg-kpi"><span>🏆</span><strong>#{s.school_rank}</strong><small>state rank</small></div>
                </div>

                <div className="esg-content-grid">
                    <div className="esg-card">
                        <h4>🏆 Class Leaderboard</h4>
                        {s.class_leaderboard.map((c, i) => (
                            <div key={c.class_name} className="esg-dept-row">
                                <span className="esg-dept-rank">#{i + 1}</span>
                                <span className="esg-dept-name" style={{ fontSize: '0.85rem' }}>{c.class_name}</span>
                                <span className="esg-dept-count">{c.actions}</span>
                            </div>
                        ))}
                    </div>

                    {/* eco-transcript generator */}
                    <div className="esg-card">
                        <h4>📜 Generate Eco-Transcript</h4>
                        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>
                            Blockchain-verified credential for college applications & community service records.
                        </p>
                        <input
                            id="transcript-wallet-input"
                            className="partner-input"
                            placeholder="Student wallet address"
                            value={walletInput}
                            onChange={e => setWalletInput(e.target.value)}
                        />
                        <button
                            id="generate-transcript-btn"
                            className="partner-btn partner-btn--primary"
                            onClick={handleGenerateTranscript}
                            disabled={loading}
                            style={{ marginTop: '0.75rem', width: '100%' }}
                        >
                            {loading ? 'Generating…' : '📜 Generate Transcript'}
                        </button>
                    </div>
                </div>

                {transcript && <TranscriptView t={transcript} />}
            </div>
        </div>
    )
}
