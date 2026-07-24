import React, { useState } from 'react'
import { registerPartner } from '../../api'

type OrgType = 'brand' | 'corporate_esg' | 'school' | 'ngo' | 'government'

const ORG_TYPE_OPTIONS: { value: OrgType; label: string; icon: string; hint: string }[] = [
    { value: 'brand',        label: 'Brand Challenge',  icon: '🏆', hint: 'Sponsor an eco-challenge for users' },
    { value: 'corporate_esg',label: 'Corporate ESG',    icon: '📊', hint: 'Run employee eco-engagement programs' },
    { value: 'school',       label: 'School / University',icon:'🏫',hint: 'Earn eco-transcripts for students' },
    { value: 'ngo',          label: 'NGO / Nonprofit',  icon: '🌊', hint: 'Host large-scale verified events' },
    { value: 'government',   label: 'Government / City', icon: '🏛', hint: 'Track citizen eco-engagement' },
]

const PLAN_BY_TYPE: Record<OrgType, string[]> = {
    brand:         [],
    corporate_esg: ['starter', 'growth', 'enterprise'],
    school:        ['free', 'school', 'district'],
    ngo:           [],
    government:    [],
}

export default function ApplyPanel() {
    const [orgType, setOrgType]         = useState<OrgType>('brand')
    const [orgName, setOrgName]         = useState('')
    const [contactName, setContactName] = useState('')
    const [contactEmail, setContactEmail] = useState('')
    const [website, setWebsite]         = useState('')
    const [description, setDescription] = useState('')
    const [plan, setPlan]               = useState('')
    const [employeeCount, setEmployeeCount] = useState('')
    const [challengeIdea, setChallengeIdea] = useState('')
    const [ecoBudget, setEcoBudget]     = useState('')
    const [status, setStatus]           = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage]         = useState('')

    const plans = PLAN_BY_TYPE[orgType] ?? []

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setStatus('loading')
        try {
            const result = await registerPartner({
                org_name: orgName, org_type: orgType,
                contact_name: contactName, contact_email: contactEmail,
                website: website || undefined, description: description || undefined,
                plan: plan || undefined,
                employee_count: employeeCount ? parseInt(employeeCount) : undefined,
                challenge_idea: challengeIdea || undefined,
                eco_budget: ecoBudget ? parseInt(ecoBudget) : undefined,
            })
            setStatus('success')
            setMessage(result.message ?? 'Application submitted!')
        } catch {
            setStatus('error')
            setMessage('Submission failed — please try again or contact us directly.')
        }
    }

    if (status === 'success') {
        return (
            <div className="apply-success">
                <div className="apply-success-icon">✅</div>
                <h2>Application Received!</h2>
                <p>{message}</p>
                <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>
                    Pending DAO review — typically 3–5 business days. We'll reach out to <strong>{contactEmail}</strong>.
                </p>
                <button className="partner-btn partner-btn--outline" onClick={() => setStatus('idle')}>
                    Submit Another
                </button>
            </div>
        )
    }

    return (
        <div className="apply-panel">
            <div className="apply-header">
                <h2>🤝 Become a Partner</h2>
                <p>Join the verified eco-action economy. Fill out the form and the DAO will review your application.</p>
            </div>

            <form id="partner-apply-form" className="apply-form" onSubmit={handleSubmit}>
                {/* org type selector */}
                <fieldset className="apply-fieldset">
                    <legend>Partnership Type</legend>
                    <div className="apply-type-grid">
                        {ORG_TYPE_OPTIONS.map(o => (
                            <label
                                key={o.value}
                                className={`apply-type-card${orgType === o.value ? ' apply-type-card--selected' : ''}`}
                                htmlFor={`org-type-${o.value}`}
                            >
                                <input
                                    type="radio" id={`org-type-${o.value}`} name="org_type"
                                    value={o.value} checked={orgType === o.value}
                                    onChange={() => { setOrgType(o.value); setPlan('') }}
                                />
                                <span className="apply-type-icon">{o.icon}</span>
                                <span className="apply-type-label">{o.label}</span>
                                <span className="apply-type-hint">{o.hint}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {/* org info */}
                <fieldset className="apply-fieldset">
                    <legend>Organisation Info</legend>
                    <div className="apply-field-row">
                        <div className="apply-field">
                            <label htmlFor="apply-org-name">Organisation Name *</label>
                            <input id="apply-org-name" className="partner-input" required
                                value={orgName} onChange={e => setOrgName(e.target.value)} />
                        </div>
                        <div className="apply-field">
                            <label htmlFor="apply-website">Website</label>
                            <input id="apply-website" className="partner-input" type="url"
                                value={website} onChange={e => setWebsite(e.target.value)} />
                        </div>
                    </div>
                    <div className="apply-field">
                        <label htmlFor="apply-description">Description / Pitch</label>
                        <textarea id="apply-description" className="partner-input partner-textarea"
                            rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                </fieldset>

                {/* contact */}
                <fieldset className="apply-fieldset">
                    <legend>Primary Contact</legend>
                    <div className="apply-field-row">
                        <div className="apply-field">
                            <label htmlFor="apply-contact-name">Full Name *</label>
                            <input id="apply-contact-name" className="partner-input" required
                                value={contactName} onChange={e => setContactName(e.target.value)} />
                        </div>
                        <div className="apply-field">
                            <label htmlFor="apply-contact-email">Email *</label>
                            <input id="apply-contact-email" className="partner-input" type="email" required
                                value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                        </div>
                    </div>
                </fieldset>

                {/* conditional fields */}
                {plans.length > 0 && (
                    <fieldset className="apply-fieldset">
                        <legend>Subscription Plan</legend>
                        <div className="apply-plan-row">
                            {plans.map(p => (
                                <label key={p} className={`apply-plan-opt${plan === p ? ' apply-plan-opt--selected' : ''}`}>
                                    <input type="radio" name="plan" value={p}
                                        checked={plan === p} onChange={() => setPlan(p)} />
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}

                {orgType === 'corporate_esg' && (
                    <div className="apply-field">
                        <label htmlFor="apply-employee-count">Number of Employees</label>
                        <input id="apply-employee-count" className="partner-input" type="number" min="1"
                            value={employeeCount} onChange={e => setEmployeeCount(e.target.value)} />
                    </div>
                )}

                {orgType === 'brand' && (
                    <fieldset className="apply-fieldset">
                        <legend>Challenge Details</legend>
                        <div className="apply-field">
                            <label htmlFor="apply-challenge-idea">Challenge Idea</label>
                            <input id="apply-challenge-idea" className="partner-input"
                                placeholder='e.g. "Repair, Don\'t Replace"'
                                value={challengeIdea} onChange={e => setChallengeIdea(e.target.value)} />
                        </div>
                        <div className="apply-field">
                            <label htmlFor="apply-eco-budget">ECO Token Budget</label>
                            <input id="apply-eco-budget" className="partner-input" type="number" min="1000"
                                placeholder="e.g. 10000"
                                value={ecoBudget} onChange={e => setEcoBudget(e.target.value)} />
                        </div>
                    </fieldset>
                )}

                {status === 'error' && <div className="partnership-toast partnership-toast--error">{message}</div>}

                <button
                    id="partner-apply-submit"
                    type="submit"
                    className="partner-btn partner-btn--primary apply-submit"
                    disabled={status === 'loading'}
                >
                    {status === 'loading' ? 'Submitting…' : '🚀 Submit Application'}
                </button>
            </form>
        </div>
    )
}
