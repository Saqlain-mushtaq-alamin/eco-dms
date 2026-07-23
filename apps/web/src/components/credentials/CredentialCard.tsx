import React from 'react'

interface CredentialCardProps {
    title: string
    credentialType: string
    rarity: 'common' | 'rare' | 'epic' | 'legendary'
    rarityColor: string
    earnedAt?: number       // Unix timestamp — undefined = not yet earned
    description: string
    isEligible?: boolean
    alreadyMinted?: boolean
    ecoCost?: number
    onMint?: () => void
    compact?: boolean
}

const RARITY_BG: Record<string, string> = {
    common:    'linear-gradient(135deg, #f9fafb, #f3f4f6)',
    rare:      'linear-gradient(135deg, #eff6ff, #dbeafe)',
    epic:      'linear-gradient(135deg, #f5f3ff, #ede9fe)',
    legendary: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
}

const TYPE_EMOJI: Record<string, string> = {
    milestone: '🏆',
    community: '🤝',
    partner:   '🌐',
    annual:    '🌟',
}

export function CredentialCard({
    title, credentialType, rarity, rarityColor, earnedAt,
    description, isEligible, alreadyMinted, ecoCost, onMint, compact,
}: CredentialCardProps) {
    const isMinted = alreadyMinted || earnedAt !== undefined
    const bg = RARITY_BG[rarity] ?? RARITY_BG.common

    return (
        <div style={{
            background: bg,
            border: `1.5px solid ${rarityColor}${isMinted ? '60' : '25'}`,
            borderRadius: compact ? 14 : 18,
            padding: compact ? '0.85rem' : '1.25rem',
            position: 'relative',
            opacity: !isEligible && !isMinted ? 0.55 : 1,
            transition: 'transform 0.15s, box-shadow 0.15s',
        }}
            onMouseEnter={e => {
                if (isMinted || isEligible) {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${rarityColor}25`
                }
            }}
            onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
            }}
        >
            {/* Rarity glow for minted */}
            {isMinted && (
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 'inherit',
                    background: `radial-gradient(circle at 50% 0%, ${rarityColor}15, transparent 70%)`,
                    pointerEvents: 'none',
                }} />
            )}

            {/* Type emoji + rarity pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compact ? 6 : 10 }}>
                <span style={{ fontSize: compact ? '1.4rem' : '1.8rem' }}>
                    {TYPE_EMOJI[credentialType] ?? '🎖️'}
                </span>
                <span style={{
                    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: rarityColor,
                    background: `${rarityColor}15`, borderRadius: 4, padding: '2px 6px',
                    alignSelf: 'flex-start',
                }}>
                    {rarity}
                </span>
            </div>

            {/* Title */}
            <div style={{
                fontWeight: 800, fontSize: compact ? '0.82rem' : '0.9rem',
                color: '#111827', lineHeight: 1.2, marginBottom: 4,
            }}>
                {title}
            </div>

            {/* Description */}
            {!compact && (
                <div style={{ fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.5, marginBottom: 10 }}>
                    {description}
                </div>
            )}

            {/* Earned date or mint button */}
            {isMinted && earnedAt && (
                <div style={{
                    fontSize: '0.67rem', color: rarityColor, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    ✅ Earned {new Date(earnedAt * 1000).toLocaleDateString()}
                </div>
            )}

            {isMinted && !earnedAt && (
                <div style={{ fontSize: '0.67rem', color: rarityColor, fontWeight: 700 }}>
                    ✅ Credential minted on-chain
                </div>
            )}

            {!isMinted && isEligible && onMint && (
                <button
                    id={`mint-credential-${title.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={onMint}
                    style={{
                        width: '100%', padding: '0.5rem', borderRadius: 10, border: 'none',
                        cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem',
                        background: `linear-gradient(135deg, ${rarityColor}, ${rarityColor}cc)`,
                        color: '#fff', marginTop: 6,
                    }}
                >
                    🎖️ Mint · {ecoCost} ECO
                </button>
            )}

            {!isMinted && !isEligible && (
                <div style={{ fontSize: '0.67rem', color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>
                    🔒 Not yet eligible
                </div>
            )}
        </div>
    )
}
