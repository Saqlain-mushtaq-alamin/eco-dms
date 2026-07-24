import React, { useState } from 'react'
import ChallengesPanel from '../components/partnerships/ChallengesPanel'
import ESGPanel from '../components/partnerships/ESGPanel'
import SchoolPanel from '../components/partnerships/SchoolPanel'
import CarbonPanel from '../components/partnerships/CarbonPanel'
import ApplyPanel from '../components/partnerships/ApplyPanel'

/* ── tab ids ── */
type Tab = 'overview' | 'challenges' | 'esg' | 'school' | 'carbon' | 'apply'

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',   label: 'Overview',       icon: '🌍' },
    { id: 'challenges', label: 'Challenges',      icon: '🏆' },
    { id: 'esg',        label: 'Corporate ESG',   icon: '📊' },
    { id: 'school',     label: 'Schools',         icon: '🏫' },
    { id: 'carbon',     label: 'Carbon Credits',  icon: '🌱' },
    { id: 'apply',      label: 'Become a Partner',icon: '🤝' },
]

/* ── tiny stat card ── */
export function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
    return (
        <div className="partnership-stat-card">
            <div className="partnership-stat-icon">{icon}</div>
            <div className="partnership-stat-value">{value}</div>
            <div className="partnership-stat-label">{label}</div>
            {sub && <div className="partnership-stat-sub">{sub}</div>}
        </div>
    )
}

/* ── section wrapper ── */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="partnership-section">
            <h2 className="partnership-section-title">{title}</h2>
            {children}
        </div>
    )
}

/* ── placeholder while sub-sections load ── */
function TabContent({ tab }: { tab: Tab }) {
    // each tab panel imported lazily in next steps
    switch (tab) {
        case 'overview':   return <OverviewPanel />
        case 'challenges': return <ChallengesPanel />
        case 'esg':        return <ESGPanel />
        case 'school':     return <SchoolPanel />
        case 'carbon':     return <CarbonPanel />
        case 'apply':      return <ApplyPanel />
        default:           return null
    }
}

/* ── overview panel (self-contained) ── */
function OverviewPanel() {
    const tiers = [
        { tier: 'Tier 1', name: 'Brand Challenges', icon: '🏆', color: '#f59e0b',
          desc: 'Sponsor eco-challenges, buy ECO from DEX for prize pools, get verified impact reports.',
          examples: ['Patagonia', 'REI', 'Whole Foods'], ecoBudget: '2,000–20,000 ECO' },
        { tier: 'Tier 2', name: 'Corporate ESG', icon: '📊', color: '#6366f1',
          desc: 'Run employee eco-programs. Monthly subscription includes ECO for rewards.',
          examples: ['$500–$5,000 / mo'], ecoBudget: '2,000–30,000 ECO / mo' },
        { tier: 'Tier 3', name: 'Carbon Credits', icon: '🌿', color: '#10b981',
          desc: 'Bundle verified eco-actions into carbon credit packages for compliance buyers.',
          examples: ['Verra', 'Gold Standard', 'Climate Action Reserve'], ecoBudget: 'Custom' },
    ]

    const revenueTargets = [
        { stream: 'Brand Challenges',    y1: '$25K',    y2: '$200K',   y3: '$1M' },
        { stream: 'Corporate ESG',        y1: '$30K',    y2: '$300K',   y3: '$2M' },
        { stream: 'School Programs',      y1: '$5K',     y2: '$50K',    y3: '$250K' },
        { stream: 'Carbon Credits',       y1: '—',       y2: '$100K',   y3: '$1M' },
        { stream: 'Verification-as-a-Service', y1: '—', y2: '$50K',    y3: '$500K' },
    ]

    return (
        <div>
            {/* hero stats */}
            <div className="partnership-stats-row">
                <StatCard icon="🎯" label="ECO Buy Target" value="35%" sub="from external sources by Month 12" />
                <StatCard icon="💰" label="Year 1 Revenue" value="$60K" sub="across all partnership streams" />
                <StatCard icon="🌍" label="Year 3 Revenue" value="$4.75M" sub="projected platform growth" />
                <StatCard icon="🤝" label="Partner Types" value="5" sub="Brand · ESG · School · NGO · Gov" />
            </div>

            {/* tier cards */}
            <div className="partnership-tiers">
                {tiers.map(t => (
                    <div key={t.tier} className="partnership-tier-card" style={{ '--tier-color': t.color } as React.CSSProperties}>
                        <div className="partnership-tier-badge">{t.tier}</div>
                        <div className="partnership-tier-icon">{t.icon}</div>
                        <h3 className="partnership-tier-name">{t.name}</h3>
                        <p className="partnership-tier-desc">{t.desc}</p>
                        <div className="partnership-tier-meta">
                            <span>🪙 {t.ecoBudget}</span>
                        </div>
                        <div className="partnership-tier-examples">
                            {t.examples.map(e => <span key={e} className="partnership-tag">{e}</span>)}
                        </div>
                    </div>
                ))}
            </div>

            {/* revenue table */}
            <Section title="📈 Revenue Model">
                <div className="partnership-table-wrap">
                    <table className="partnership-table">
                        <thead>
                            <tr><th>Revenue Stream</th><th>Year 1</th><th>Year 2</th><th>Year 3</th></tr>
                        </thead>
                        <tbody>
                            {revenueTargets.map(r => (
                                <tr key={r.stream}>
                                    <td>{r.stream}</td>
                                    <td>{r.y1}</td><td>{r.y2}</td><td>{r.y3}</td>
                                </tr>
                            ))}
                            <tr className="partnership-table-total">
                                <td><strong>Total</strong></td>
                                <td><strong>$60K</strong></td>
                                <td><strong>$700K</strong></td>
                                <td><strong>$4.75M</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* acquisition phases */}
            <Section title="🗺️ Acquisition Roadmap">
                <div className="partnership-phases">
                    {[
                        { phase: 'Phase 1', period: 'Month 1–3', title: 'Prove the Model',
                          steps: ['Partner with 3–5 local businesses', 'Free 90-day pilot', 'Build case studies'] },
                        { phase: 'Phase 2', period: 'Month 4–6', title: 'Scale Regionally',
                          steps: ['Target eco-brands (Patagonia, REI)', '5–10 school pilots', 'Local NGO + city government'] },
                        { phase: 'Phase 3', period: 'Month 7–12', title: 'National / International',
                          steps: ['Fortune 500 ESG departments', 'Carbon registry integrations', 'Multi-language + PR'] },
                    ].map(p => (
                        <div key={p.phase} className="partnership-phase">
                            <div className="partnership-phase-header">
                                <span className="partnership-phase-badge">{p.phase}</span>
                                <span className="partnership-phase-period">{p.period}</span>
                            </div>
                            <h4>{p.title}</h4>
                            <ul>{p.steps.map(s => <li key={s}>{s}</li>)}</ul>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    )
}

/* ── main page ── */
export default function PartnershipsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('overview')

    return (
        <div className="partnerships-page">
            <div className="partnerships-header">
                <h1 className="partnerships-title">🌍 Industry & Partnerships</h1>
                <p className="partnerships-subtitle">
                    External demand is what gives ECO real value.
                    Connect companies, schools, and NGOs to the verified eco-action economy.
                </p>
            </div>

            {/* tab bar */}
            <div className="partnership-tabs">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        id={`tab-${t.id}`}
                        className={`partnership-tab${activeTab === t.id ? ' partnership-tab--active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        <span className="partnership-tab-icon">{t.icon}</span>
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* panel */}
            <div className="partnership-panel">
                <TabContent tab={activeTab} />
            </div>
        </div>
    )
}
