import React from 'react'

const DEMO_PACKAGES = [
    {
        package_id: 'ECP-20260-PDX-001', region: 'Portland, OR', period: 'Q2-2026',
        verified_actions: 12345, total_co2_offset_kg: 34567, price_usd: 2500,
        eco_tokens_included: 5000, status: 'available',
        blockchain_proofs: ['0xabc123…', '0xdef456…'],
    },
    {
        package_id: 'ECP-20260-SEA-002', region: 'Seattle, WA', period: 'Q2-2026',
        verified_actions: 8900, total_co2_offset_kg: 21340, price_usd: 1800,
        eco_tokens_included: 3500, status: 'available',
        blockchain_proofs: ['0x111aaa…', '0x222bbb…'],
    },
    {
        package_id: 'ECP-20260-AUS-003', region: 'Austin, TX', period: 'Q1-2026',
        verified_actions: 5600, total_co2_offset_kg: 12480, price_usd: 1100,
        eco_tokens_included: 2000, status: 'sold',
        blockchain_proofs: ['0x333ccc…'],
    },
]

const DEMO_NGO_EVENTS = [
    {
        event_id: 'ngo-1', org: 'Ocean Conservancy', title: 'Coastal Cleanup Day',
        location: 'Santa Monica Beach, CA', event_date: '2026-08-15',
        volunteer_count: 342, eco_per_volunteer: 75, status: 'upcoming',
    },
    {
        event_id: 'ngo-2', org: 'Sierra Club', title: 'Trail Restoration Sprint',
        location: 'Mt. Hood National Forest, OR', event_date: '2026-08-22',
        volunteer_count: 178, eco_per_volunteer: 60, status: 'upcoming',
    },
]

const TARGET_PARTNERS = ['Verra', 'Gold Standard', 'Climate Action Reserve', 'Corporate sustainability depts']

export default function CarbonPanel() {
    return (
        <div>
            {/* intro */}
            <div className="carbon-intro">
                <div className="carbon-intro-icon">🌿</div>
                <div>
                    <h2>Carbon Credit Packages — Tier 3</h2>
                    <p>
                        EcoDMS bundles thousands of ML-verified eco-actions into structured Carbon Credit Packages
                        sold to compliance buyers. Revenue is split 40% platform · 30% users · 30% community projects.
                    </p>
                    <div className="carbon-targets">
                        {TARGET_PARTNERS.map(p => <span key={p} className="partnership-tag">{p}</span>)}
                    </div>
                </div>
            </div>

            {/* how it works */}
            <div className="carbon-flow">
                {[
                    'Individual eco-actions (thousands)',
                    'Aggregated by region / type',
                    'Verified: ML ensemble + community',
                    'Bundled into Eco Credit Packages',
                    'Sold to carbon credit buyers',
                    'Revenue shared 40/30/30',
                ].map((step, i) => (
                    <React.Fragment key={step}>
                        <div className="carbon-flow-step">
                            <div className="carbon-flow-num">{i + 1}</div>
                            <span>{step}</span>
                        </div>
                        {i < 5 && <div className="carbon-flow-arrow">→</div>}
                    </React.Fragment>
                ))}
            </div>

            {/* packages */}
            <h3 style={{ margin: '2rem 0 1rem' }}>📦 Available Packages</h3>
            <div className="carbon-package-grid">
                {DEMO_PACKAGES.map(pkg => (
                    <div key={pkg.package_id} className={`carbon-package-card${pkg.status === 'sold' ? ' carbon-package-card--sold' : ''}`}>
                        <div className="carbon-package-header">
                            <span className="carbon-package-id">{pkg.package_id}</span>
                            <span className={`carbon-package-status carbon-package-status--${pkg.status}`}>{pkg.status}</span>
                        </div>
                        <div className="carbon-package-region">📍 {pkg.region} · {pkg.period}</div>

                        <div className="carbon-package-stats">
                            <div><strong>{pkg.verified_actions.toLocaleString()}</strong><small>verified actions</small></div>
                            <div><strong>{pkg.total_co2_offset_kg.toLocaleString()} kg</strong><small>CO₂ offset</small></div>
                            <div><strong>${pkg.price_usd.toLocaleString()}</strong><small>price</small></div>
                            <div><strong>{pkg.eco_tokens_included.toLocaleString()}</strong><small>ECO included</small></div>
                        </div>

                        <div className="carbon-package-method">
                            <span>🔍</span> ML (3-model ensemble) + community voting (avg 94% consensus)
                        </div>
                        <div className="carbon-package-proofs">
                            {pkg.blockchain_proofs.map(p => (
                                <span key={p} className="carbon-proof-badge">{p}</span>
                            ))}
                        </div>

                        {pkg.status === 'available' && (
                            <button
                                id={`buy-carbon-pkg-${pkg.package_id}`}
                                className="partner-btn partner-btn--primary"
                                style={{ marginTop: '1rem', width: '100%' }}
                            >
                                Contact to Purchase
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* NGO events */}
            <h3 style={{ margin: '2.5rem 0 1rem' }}>🌊 NGO Partner Events</h3>
            <p style={{ opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Large-scale eco-events with QR check-in verification. Participants earn ECO + "NGO-Verified" badge.
            </p>
            <div className="ngo-event-grid">
                {DEMO_NGO_EVENTS.map(e => (
                    <div key={e.event_id} className="ngo-event-card">
                        <div className="ngo-event-org">{e.org}</div>
                        <h4>{e.title}</h4>
                        <div className="ngo-event-meta">
                            <span>📍 {e.location}</span>
                            <span>📅 {e.event_date}</span>
                        </div>
                        <div className="ngo-event-stats">
                            <span>👥 {e.volunteer_count} volunteers</span>
                            <span>🪙 {e.eco_per_volunteer} ECO each</span>
                        </div>
                        <button
                            id={`rsvp-ngo-${e.event_id}`}
                            className="partner-btn partner-btn--outline"
                            style={{ marginTop: '1rem', width: '100%' }}
                        >
                            RSVP (wallet-based)
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
