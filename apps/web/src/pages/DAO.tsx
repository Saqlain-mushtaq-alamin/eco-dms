import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Proposal {
    id: number
    proposer: string
    title: string
    description: string
    targetParam: string
    newValue: number
    votesFor: bigint | string
    votesAgainst: bigint | string
    deadline: number
    executed: boolean
    passed: boolean
    active: boolean
}

const MOCK_PROPOSALS: Proposal[] = [
    {
        id: 1,
        proposer: '0x1234...abcd',
        title: 'Increase Base ECO Reward to 7',
        description: 'Raise the base verification reward from 5 ECO to 7 ECO to attract more high-quality content creators during the platform growth phase.',
        targetParam: 'baseReward',
        newValue: 7,
        votesFor: '12500',
        votesAgainst: '3200',
        deadline: Date.now() / 1000 + 5 * 86400,
        executed: false,
        passed: false,
        active: true,
    },
    {
        id: 2,
        proposer: '0x5678...ef01',
        title: 'Add Solar Energy as Verified Category',
        description: 'Expand the ML verification categories to include residential solar panel installation documentation.',
        targetParam: 'newCategory',
        newValue: 8,
        votesFor: '45600',
        votesAgainst: '1100',
        deadline: Date.now() / 1000 - 86400,
        executed: true,
        passed: true,
        active: false,
    },
    {
        id: 3,
        proposer: '0x9abc...2345',
        title: 'Reduce Boost Tier 1 Cost to 3 ECO',
        description: 'Lower the entry-level post boost cost to make visibility boosting accessible to newer community members with smaller balances.',
        targetParam: 'boostTier1Cost',
        newValue: 3,
        votesFor: '8900',
        votesAgainst: '11200',
        deadline: Date.now() / 1000 - 2 * 86400,
        executed: true,
        passed: false,
        active: false,
    },
]

function StatusBadge({ proposal }: { proposal: Proposal }) {
    if (proposal.active) {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.75rem', borderRadius: '99px',
                fontSize: '0.72rem', fontWeight: 700,
                background: 'rgba(34,197,94,0.15)', color: '#16a34a',
                border: '1px solid rgba(34,197,94,0.3)',
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Active
            </span>
        )
    }
    if (proposal.passed) {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.75rem', borderRadius: '99px',
                fontSize: '0.72rem', fontWeight: 700,
                background: 'rgba(59,130,246,0.12)', color: '#2563eb',
                border: '1px solid rgba(59,130,246,0.3)',
            }}>
                ✓ Passed &amp; Executed
            </span>
        )
    }
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.25rem 0.75rem', borderRadius: '99px',
            fontSize: '0.72rem', fontWeight: 700,
            background: 'rgba(239,68,68,0.1)', color: '#dc2626',
            border: '1px solid rgba(239,68,68,0.25)',
        }}>
            ✗ Rejected
        </span>
    )
}

function VoteBar({ votesFor, votesAgainst }: { votesFor: string; votesAgainst: string }) {
    const forNum = Number(votesFor)
    const againstNum = Number(votesAgainst)
    const total = forNum + againstNum || 1
    const forPct = Math.round((forNum / total) * 100)

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {forNum.toLocaleString()} ECO ({forPct}%)</span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ {againstNum.toLocaleString()} ECO ({100 - forPct}%)</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'rgba(239,68,68,0.2)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                    width: `${forPct}%`,
                    transition: 'width 0.6s ease',
                }} />
            </div>
        </div>
    )
}

function ProposalCard({
    proposal,
    onVote,
}: {
    proposal: Proposal
    onVote: (id: number, support: boolean) => void
}) {
    const deadline = new Date(proposal.deadline * 1000)
    const isExpired = !proposal.active

    return (
        <div style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 20,
            padding: '1.5rem',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 4 }}>
                        Proposal #{proposal.id} · by {proposal.proposer}
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                        {proposal.title}
                    </h3>
                </div>
                <StatusBadge proposal={proposal} />
            </div>

            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.6, marginBottom: 16 }}>
                {proposal.description}
            </p>

            <VoteBar votesFor={String(proposal.votesFor)} votesAgainst={String(proposal.votesAgainst)} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {isExpired
                        ? `Ended ${deadline.toLocaleDateString()}`
                        : `Ends ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}`}
                </div>

                {proposal.active && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            id={`vote-for-${proposal.id}`}
                            onClick={() => onVote(proposal.id, true)}
                            style={{
                                padding: '0.45rem 1rem', borderRadius: 10, fontSize: '0.82rem',
                                fontWeight: 700, cursor: 'pointer',
                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                color: '#fff', border: 'none',
                            }}
                        >
                            ✓ Vote For
                        </button>
                        <button
                            id={`vote-against-${proposal.id}`}
                            onClick={() => onVote(proposal.id, false)}
                            style={{
                                padding: '0.45rem 1rem', borderRadius: 10, fontSize: '0.82rem',
                                fontWeight: 700, cursor: 'pointer',
                                background: 'rgba(239,68,68,0.1)', color: '#dc2626',
                                border: '1px solid rgba(239,68,68,0.3)',
                            }}
                        >
                            ✗ Vote Against
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function DAOPage() {
    const navigate = useNavigate()
    const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [voteMsg, setVoteMsg] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')

    const filtered = proposals.filter(p => {
        if (filter === 'active') return p.active
        if (filter === 'closed') return !p.active
        return true
    })

    const handleVote = (id: number, support: boolean) => {
        setVoteMsg(`Vote "${support ? 'For' : 'Against'}" submitted for Proposal #${id}. (Wallet confirmation required in production.)`)
        setTimeout(() => setVoteMsg(null), 4000)
    }

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTitle.trim() || !newDesc.trim()) return
        const newProposal: Proposal = {
            id: proposals.length + 1,
            proposer: '0xYou...rself',
            title: newTitle,
            description: newDesc,
            targetParam: 'custom',
            newValue: 0,
            votesFor: '0',
            votesAgainst: '0',
            deadline: Date.now() / 1000 + 7 * 86400,
            executed: false,
            passed: false,
            active: true,
        }
        setProposals(prev => [newProposal, ...prev])
        setNewTitle('')
        setNewDesc('')
        setShowCreateForm(false)
        setVoteMsg('Proposal submitted! Cost: 50 ECO burned. (Wallet confirmation required in production.)')
        setTimeout(() => setVoteMsg(null), 5000)
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                            🗳️ EcoDAO
                        </h1>
                        <p style={{ color: '#6b7280', marginTop: 4, fontSize: '0.9rem' }}>
                            Community governance — Level 10+ members vote with quadratic weight
                        </p>
                    </div>
                    <button
                        id="create-proposal-btn"
                        onClick={() => setShowCreateForm(s => !s)}
                        style={{
                            padding: '0.6rem 1.25rem', borderRadius: 12, fontSize: '0.87rem',
                            fontWeight: 700, cursor: 'pointer',
                            background: 'linear-gradient(135deg, #abca2f, #7ea01a)',
                            color: '#0d1a00', border: 'none',
                            boxShadow: '0 2px 8px rgba(171,202,47,0.3)',
                        }}
                    >
                        + New Proposal (50 ECO)
                    </button>
                </div>

                {/* Stats bar */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12, marginTop: '1.25rem',
                }}>
                    {[
                        { label: 'Active Proposals', value: proposals.filter(p => p.active).length },
                        { label: 'Passed', value: proposals.filter(p => p.passed).length },
                        { label: 'Total Proposals', value: proposals.length },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            background: 'rgba(171,202,47,0.1)', borderRadius: 14,
                            padding: '0.85rem', textAlign: 'center',
                            border: '1px solid rgba(171,202,47,0.25)',
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#5b6d14' }}>{stat.value}</div>
                            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create form */}
            {showCreateForm && (
                <form onSubmit={handleCreate} style={{
                    background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(171,202,47,0.3)', borderRadius: 20,
                    padding: '1.5rem', marginBottom: '1.5rem',
                    boxShadow: '0 4px 20px rgba(171,202,47,0.15)',
                }}>
                    <h3 style={{ margin: '0 0 1rem', color: '#111827', fontSize: '1rem', fontWeight: 700 }}>
                        📝 Submit New Proposal
                    </h3>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                            Title
                        </label>
                        <input
                            id="proposal-title-input"
                            type="text"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder="e.g. Increase base reward to 8 ECO"
                            style={{
                                width: '100%', padding: '0.6rem 0.9rem', borderRadius: 10,
                                border: '1px solid #d1d5db', fontSize: '0.87rem',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                            Description
                        </label>
                        <textarea
                            id="proposal-desc-input"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            rows={4}
                            placeholder="Explain your proposal and its rationale..."
                            style={{
                                width: '100%', padding: '0.6rem 0.9rem', borderRadius: 10,
                                border: '1px solid #d1d5db', fontSize: '0.87rem',
                                resize: 'vertical', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setShowCreateForm(false)}
                            style={{ padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.82rem', border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff' }}>
                            Cancel
                        </button>
                        <button id="submit-proposal-btn" type="submit"
                            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg, #abca2f, #7ea01a)', color: '#0d1a00', border: 'none' }}>
                            Submit &amp; Burn 50 ECO
                        </button>
                    </div>
                </form>
            )}

            {/* Vote notification */}
            {voteMsg && (
                <div style={{
                    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem',
                    fontSize: '0.85rem', color: '#15803d', fontWeight: 600,
                }}>
                    ✓ {voteMsg}
                </div>
            )}

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                {(['all', 'active', 'closed'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{
                            padding: '0.35rem 0.9rem', borderRadius: 8, fontSize: '0.8rem',
                            fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: filter === f ? '#abca2f' : 'rgba(0,0,0,0.06)',
                            color: filter === f ? '#0d1a00' : '#6b7280',
                        }}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Proposals list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
                        No proposals found.
                    </div>
                ) : (
                    filtered.map(p => (
                        <ProposalCard key={p.id} proposal={p} onVote={handleVote} />
                    ))
                )}
            </div>

            {/* Info box */}
            <div style={{
                marginTop: '2rem', padding: '1.25rem', borderRadius: 16,
                background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
                fontSize: '0.82rem', color: '#374151', lineHeight: 1.7,
            }}>
                <strong>ℹ️ How EcoDAO Works:</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                    <li>Submit proposals: 50 ECO cost (25 burned, 25 to treasury)</li>
                    <li>Voting uses <strong>quadratic weighting</strong> — larger balances have diminishing returns</li>
                    <li>Proposals need Level 10+ to create; all verified users can vote</li>
                    <li>Voting period: 7 days. Execution: automatic if 60%+ threshold met</li>
                </ul>
            </div>
        </div>
    )
}
