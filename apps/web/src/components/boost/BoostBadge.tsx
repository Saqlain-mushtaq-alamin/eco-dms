import React from 'react'

interface BoostBadgeProps {
    level: 0 | 1 | 2 | 3
    expiresAt?: number    // Unix timestamp
    compact?: boolean
}

const TIER_META = {
    0: { name: 'Not Boosted', emoji: '',   color: '#9ca3af', bgColor: 'transparent' },
    1: { name: 'Spark',       emoji: '✨', color: '#f59e0b', bgColor: '#fef3c7' },
    2: { name: 'Flame',       emoji: '🔥', color: '#f97316', bgColor: '#fff7ed' },
    3: { name: 'Wildfire',    emoji: '⚡', color: '#ef4444', bgColor: '#fef2f2' },
}

function formatTimeLeft(expiresAt: number): string {
    const now = Date.now() / 1000
    const left = expiresAt - now
    if (left <= 0) return 'Expired'
    if (left < 3600)  return `${Math.floor(left / 60)}m left`
    if (left < 86400) return `${Math.floor(left / 3600)}h left`
    return `${Math.floor(left / 86400)}d left`
}

export function BoostBadge({ level, expiresAt, compact = false }: BoostBadgeProps) {
    if (level === 0) return null

    const meta = TIER_META[level]
    const timeLeft = expiresAt ? formatTimeLeft(expiresAt) : null

    if (compact) {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: meta.bgColor, color: meta.color,
                border: `1px solid ${meta.color}40`,
                borderRadius: 6, padding: '1px 6px',
                fontSize: '0.68rem', fontWeight: 800,
            }}>
                {meta.emoji} {meta.name}
            </span>
        )
    }

    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: meta.bgColor,
            border: `1.5px solid ${meta.color}50`,
            borderRadius: 10, padding: '4px 10px',
        }}>
            <span style={{ fontSize: '1rem' }}>{meta.emoji}</span>
            <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: meta.color, lineHeight: 1.1 }}>
                    {meta.name} Boost
                </div>
                {timeLeft && (
                    <div style={{ fontSize: '0.62rem', color: meta.color + 'bb' }}>
                        {timeLeft}
                    </div>
                )}
            </div>
        </div>
    )
}
