import React from 'react'

interface StreakBadgeProps {
    currentStreak: number
    longestStreak: number
    isActiveToday: boolean
    streakAtRisk: boolean
    weeklyCompletion: number   // 0-7 days active this week
    size?: 'sm' | 'md' | 'lg'
}

const STREAK_TIERS = [
    { min: 100, emoji: '🔥', label: 'Legendary', color: '#f59e0b' },
    { min: 30,  emoji: '⚡', label: 'On Fire',   color: '#f97316' },
    { min: 14,  emoji: '🌟', label: 'Blazing',   color: '#eab308' },
    { min: 7,   emoji: '🌱', label: 'Growing',   color: '#22c55e' },
    { min: 3,   emoji: '✨', label: 'Starting',  color: '#06b6d4' },
    { min: 0,   emoji: '💧', label: 'New',       color: '#64748b' },
]

function getStreakTier(days: number) {
    return STREAK_TIERS.find(t => days >= t.min) ?? STREAK_TIERS[STREAK_TIERS.length - 1]
}

export function StreakBadge({
    currentStreak,
    longestStreak,
    isActiveToday,
    streakAtRisk,
    weeklyCompletion,
    size = 'md',
}: StreakBadgeProps) {
    const tier = getStreakTier(currentStreak)

    const sizes = {
        sm: { number: '1.5rem', emoji: '1.1rem', pad: '0.5rem 0.75rem', gap: 6 },
        md: { number: '2.2rem', emoji: '1.4rem', pad: '0.85rem 1.2rem', gap: 8 },
        lg: { number: '3rem',   emoji: '1.8rem', pad: '1.25rem 1.75rem', gap: 10 },
    }
    const s = sizes[size]

    return (
        <div style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            gap: s.gap, padding: s.pad, borderRadius: 18,
            background: `linear-gradient(135deg, ${tier.color}18, ${tier.color}08)`,
            border: `1.5px solid ${tier.color}40`,
        }}>
            {/* Main streak number */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: s.emoji }}>{tier.emoji}</span>
                <span style={{
                    fontSize: s.number, fontWeight: 900,
                    color: tier.color, lineHeight: 1,
                    fontFamily: 'Inter, sans-serif',
                }}>
                    {currentStreak}
                </span>
                <span style={{
                    fontSize: '0.72rem', color: '#6b7280', fontWeight: 600,
                    alignSelf: 'flex-end', paddingBottom: 2,
                }}>
                    {currentStreak === 1 ? 'day' : 'days'}
                </span>
            </div>

            {/* Status label */}
            <div style={{
                fontSize: '0.7rem', fontWeight: 700,
                color: streakAtRisk ? '#f59e0b' : isActiveToday ? tier.color : '#9ca3af',
                letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
                {streakAtRisk
                    ? '⚠️ Post today to keep streak!'
                    : isActiveToday
                        ? `${tier.label} Streak`
                        : currentStreak > 0 ? 'Streak Ended' : 'Start Your Streak'}
            </div>

            {/* Weekly dots */}
            {size !== 'sm' && (
                <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: i < weeklyCompletion ? tier.color : '#e5e7eb',
                            transition: 'background 0.2s',
                        }} />
                    ))}
                </div>
            )}

            {/* Longest streak */}
            {size === 'lg' && longestStreak > currentStreak && (
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                    Best: <strong>{longestStreak} days</strong>
                </div>
            )}
        </div>
    )
}
