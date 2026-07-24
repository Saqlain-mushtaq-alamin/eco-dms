import React, { useState } from 'react'
import { type ESGDashboardStats } from '../../api'

const DEMO_ESG: ESGDashboardStats = {
    partner_id: 'demo-esg', org_name: 'TechCorp Inc.', plan: 'growth',
    enrolled_employees: 450, active_this_month: 312, verified_actions: 4567,
    co2_offset_kg: 8234, eco_distributed: 10_000,
    top_departments: [
        { name: 'Engineering', actions: 890 },
        { name: 'Marketing',   actions: 670 },
        { name: 'Sales',       actions: 450 },
        { name: 'HR',          actions: 320 },
        { name: 'Finance',     actions: 210 },
    ],
    monthly_trend: [
        { month: 'Mar', actions: 600 },
        { month: 'Apr', actions: 1200 },
        { month: 'May', actions: 1980 },
        { month: 'Jun', actions: 3120 },
        { month: 'Jul', actions: 4567 },
    ],
    as_of: new Date().toISOString(),
}

const PLANS = [
    { id: 'starter',    label: 'Starter',    price: '$500/mo',  employees: '≤100',       eco: '2,000',  features: ['Basic dashboard', 'Monthly reports'] },
    { id: 'growth',     label: 'Growth',     price: '$2,000/mo', employees: '≤500',      eco: '10,000', features: ['Full dashboard', 'Weekly reports', 'Challenges'], popular: true },
    { id: 'enterprise', label: 'Enterprise', price: '$5,000/mo', employees: 'Unlimited', eco: '30,000', features: ['Custom branding', 'API access', 'Dedicated support'] },
]

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min(100, Math.round((value / max) * 100))
    return (
        <div className="esg-mini-bar-bg">
            <div className="esg-mini-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
    )
}

function TrendChart({ data }: { data: { month: string; actions: number }[] }) {
    const max = Math.max(...data.map(d => d.actions))
    return (
        <div className="esg-trend-chart">
            {data.map(d => (
                <div key={d.month} className="esg-trend-col">
                    <span className="esg-trend-val">{d.actions.toLocaleString()}</span>
                    <div className="esg-trend-bar-bg">
                        <div className="esg-trend-bar" style={{ height: `${Math.round((d.actions / max) * 100)}%` }} />
                    </div>
                    <span className="esg-trend-month">{d.month}</span>
                </div>
            ))}
        </div>
    )
}

export default function ESGPanel() {
    const stats = DEMO_ESG
    const engagementRate = Math.round((stats.active_this_month / stats.enrolled_employees) * 100)
    const maxDept = Math.max(...stats.top_departments.map(d => d.actions))

    const [reportPeriod, setReportPeriod] = useState('Q2-2026')
    const [reportMsg, setReportMsg]       = useState<string | null>(null)

    function handleGenerateReport() {
        setReportMsg(`✅ ESG Report for ${reportPeriod} generated — ${stats.org_name}`)
        setTimeout(() => setReportMsg(null), 4000)
    }

    return (
        <div>
            {/* plan cards */}
            <div className="esg-plan-grid">
                {PLANS.map(p => (
                    <div key={p.id} className={`esg-plan-card${p.popular ? ' esg-plan-card--popular' : ''}`}>
                        {p.popular && <div className="esg-popular-badge">Most Popular</div>}
                        <h3>{p.label}</h3>
                        <div className="esg-plan-price">{p.price}</div>
                        <div className="esg-plan-detail">👥 {p.employees} employees</div>
                        <div className="esg-plan-detail">🪙 {p.eco} ECO / mo</div>
                        <ul className="esg-plan-features">
                            {p.features.map(f => <li key={f}>✓ {f}</li>)}
                        </ul>
                        <button id={`esg-select-${p.id}`} className="partner-btn partner-btn--outline">
                            Select Plan
                        </button>
                    </div>
                ))}
            </div>

            {/* live dashboard demo */}
            <div className="esg-dashboard-demo">
                <div className="esg-dashboard-header">
                    <div>
                        <h2>Corporate ESG Dashboard</h2>
                        <p>Company: <strong>{stats.org_name}</strong> · Plan: <strong>{stats.plan}</strong></p>
                    </div>
                    <div className="esg-report-controls">
                        <input
                            id="esg-report-period"
                            className="partner-input"
                            value={reportPeriod}
                            onChange={e => setReportPeriod(e.target.value)}
                            placeholder="Q2-2026"
                        />
                        <button id="esg-generate-report" className="partner-btn partner-btn--primary" onClick={handleGenerateReport}>
                            📄 Generate Report
                        </button>
                    </div>
                </div>
                {reportMsg && <div className="partnership-toast">{reportMsg}</div>}

                {/* kpi row */}
                <div className="esg-kpi-row">
                    <div className="esg-kpi"><span>👥</span><strong>{stats.enrolled_employees}</strong><small>enrolled</small></div>
                    <div className="esg-kpi"><span>⚡</span><strong>{stats.active_this_month}</strong><small>active ({engagementRate}%)</small></div>
                    <div className="esg-kpi"><span>✅</span><strong>{stats.verified_actions.toLocaleString()}</strong><small>verified actions</small></div>
                    <div className="esg-kpi"><span>🌿</span><strong>{stats.co2_offset_kg.toLocaleString()} kg</strong><small>CO₂ offset</small></div>
                    <div className="esg-kpi"><span>🪙</span><strong>{stats.eco_distributed.toLocaleString()}</strong><small>ECO distributed</small></div>
                </div>

                <div className="esg-content-grid">
                    {/* department leaderboard */}
                    <div className="esg-card">
                        <h4>🏆 Department Leaderboard</h4>
                        {stats.top_departments.map((d, i) => (
                            <div key={d.name} className="esg-dept-row">
                                <span className="esg-dept-rank">#{i + 1}</span>
                                <span className="esg-dept-name">{d.name}</span>
                                <MiniBar value={d.actions} max={maxDept} color="#6366f1" />
                                <span className="esg-dept-count">{d.actions}</span>
                            </div>
                        ))}
                    </div>

                    {/* trend chart */}
                    <div className="esg-card">
                        <h4>📈 Monthly Trend</h4>
                        <TrendChart data={stats.monthly_trend} />
                    </div>
                </div>

                <div className="esg-report-links">
                    <a href="#" id="esg-download-pdf" className="partner-btn partner-btn--ghost">📄 Download Q2 2026 ESG Report (PDF)</a>
                    <a href="#" id="esg-download-csv" className="partner-btn partner-btn--ghost">📊 Download Employee Impact Data (CSV)</a>
                    <a href="#" id="esg-view-proofs" className="partner-btn partner-btn--ghost">🔗 View On-Chain Verification Proofs</a>
                </div>
            </div>
        </div>
    )
}
