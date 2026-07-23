import React, { useEffect, useState } from 'react'
import { CredentialCard } from '../components/credentials/CredentialCard'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface EligibilityItem {
    credential_id: string
    title: string
    credential_type: string
    rarity: string
    rarity_color: string
    description: string
    is_eligible: boolean
    already_minted: boolean
    eco_cost: number
}

interface MintModalProps {
    item: EligibilityItem
    onClose: () => void
    onConfirm: () => Promise<void>
}

function MintModal({ item, onClose, onConfirm }: MintModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handle = async () => {
        setLoading(true)
        setError(null)
        try {
            await onConfirm()
            onClose()
        } catch (e: any) {
            setError(e?.message ?? 'Transaction failed')
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 8500,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 22, padding: '1.75rem',
                maxWidth: 400, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1.05rem' }}>
                    🎖️ Mint Soulbound Credential
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#6b7280' }}>
                    This credential is non-transferable and permanently tied to your wallet.
                </p>

                <CredentialCard
                    title={item.title}
                    credentialType={item.credential_type}
                    rarity={item.rarity as any}
                    rarityColor={item.rarity_color}
                    description={item.description}
                    isEligible={true}
                />

                <div style={{
                    background: '#fff7ed', borderRadius: 10,
                    padding: '0.6rem 0.85rem', margin: '14px 0',
                    fontSize: '0.72rem', color: '#92400e', fontWeight: 600,
                }}>
                    🔥 {item.eco_cost} ECO will be burned to mint this credential
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2', color: '#dc2626', borderRadius: 8,
                        padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginBottom: 12,
                    }}>⚠️ {error}</div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '0.65rem', borderRadius: 12,
                        border: '1.5px solid #e5e7eb', background: '#fff',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', color: '#374151',
                    }}>Cancel</button>
                    <button
                        id="confirm-mint-btn"
                        onClick={handle}
                        disabled={loading}
                        style={{
                            flex: 2, padding: '0.65rem', borderRadius: 12,
                            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 800, fontSize: '0.82rem',
                            background: `linear-gradient(135deg, ${item.rarity_color}, ${item.rarity_color}cc)`,
                            color: '#fff', opacity: loading ? 0.7 : 1,
                        }}>
                        {loading ? 'Confirm in wallet…' : `Mint for ${item.eco_cost} ECO`}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function CredentialsPage() {
    const [eligibility, setEligibility] = useState<EligibilityItem[]>([])
    const [filter, setFilter] = useState<'all' | 'eligible' | 'minted'>('all')
    const [loading, setLoading] = useState(true)
    const [minting, setMinting] = useState<EligibilityItem | null>(null)

    useEffect(() => {
        fetch(`${API}/api/credentials/eligibility`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(setEligibility)
            .catch(() => setEligibility([]))
            .finally(() => setLoading(false))
    }, [])

    const visible = eligibility.filter(e => {
        if (filter === 'eligible') return e.is_eligible && !e.already_minted
        if (filter === 'minted')   return e.already_minted
        return true
    })

    const handleMint = async (item: EligibilityItem) => {
        // Trigger smart contract call via window.ethereum
        if (!window.ethereum) throw new Error('No wallet detected')
        // Actual minting is handled by the user's wallet signing the tx
        // The backend signs as owner → here we call the frontend contract helper
        const { ethers } = await import('ethers')
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()

        const abi = [
            'function mintCredential(address earner, string credentialType, string title, string metadataCid) external'
        ]
        const addr = import.meta.env.VITE_ECOCREDENTIAL_ADDRESS
        if (!addr) throw new Error('VITE_ECOCREDENTIAL_ADDRESS not set')

        const contract = new ethers.Contract(addr, abi, signer)
        const tx = await contract.mintCredential(
            await signer.getAddress(),
            item.credential_type,
            item.title,
            '', // metadata CID — backend prepares this; simplified here
        )
        await tx.wait()
    }

    const eligibleCount = eligibility.filter(e => e.is_eligible && !e.already_minted).length
    const mintedCount   = eligibility.filter(e => e.already_minted).length

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
                padding: '2rem 1.5rem 3rem',
            }}>
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                    <h1 style={{ color: '#fff', margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 900 }}>
                        🎖️ Eco Credentials
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.82rem' }}>
                        Soulbound NFTs — non-transferable proof of your environmental impact
                    </p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Claimable', value: eligibleCount, color: '#86efac' },
                            { label: 'Minted',    value: mintedCount,   color: '#c4b5fd' },
                            { label: 'Total',     value: eligibility.length, color: '#fcd34d' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                                padding: '0.5rem 1rem', textAlign: 'center',
                            }}>
                                <div style={{ fontWeight: 900, fontSize: '1.2rem', color: s.color }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 800, margin: '-1.5rem auto 0', padding: '0 1rem 3rem', position: 'relative', zIndex: 1 }}>
                {/* Filter tabs */}
                <div style={{
                    display: 'flex', gap: 6, background: '#fff',
                    borderRadius: 14, padding: 6, marginBottom: 20,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                    {(['all', 'eligible', 'minted'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            flex: 1, padding: '0.5rem', borderRadius: 10,
                            border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.78rem',
                            background: filter === f ? '#312e81' : 'transparent',
                            color: filter === f ? '#fff' : '#6b7280',
                            transition: 'all 0.15s',
                        }}>
                            {f === 'all' ? 'All' : f === 'eligible' ? `✨ Claimable (${eligibleCount})` : `✅ Minted (${mintedCount})`}
                        </button>
                    ))}
                </div>

                {loading && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        Loading credentials…
                    </div>
                )}

                {/* Grid */}
                {!loading && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 14,
                    }}>
                        {visible.map(item => (
                            <CredentialCard
                                key={item.credential_id}
                                title={item.title}
                                credentialType={item.credential_type}
                                rarity={item.rarity as any}
                                rarityColor={item.rarity_color}
                                description={item.description}
                                isEligible={item.is_eligible}
                                alreadyMinted={item.already_minted}
                                ecoCost={item.eco_cost}
                                onMint={() => setMinting(item)}
                            />
                        ))}

                        {visible.length === 0 && (
                            <div style={{
                                gridColumn: '1 / -1', textAlign: 'center',
                                padding: '2.5rem', color: '#9ca3af',
                                background: '#fff', borderRadius: 16,
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔒</div>
                                <div style={{ fontWeight: 700 }}>
                                    {filter === 'eligible' ? 'No claimable credentials yet — keep posting!' : 'Nothing here yet'}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {minting && (
                <MintModal
                    item={minting}
                    onClose={() => setMinting(null)}
                    onConfirm={() => handleMint(minting)}
                />
            )}
        </div>
    )
}
