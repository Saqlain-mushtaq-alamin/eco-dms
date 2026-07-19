import React, { useMemo } from 'react'

interface CategoryData {
    name: string      // "Energy", "Transport", etc.
    kg_co2: number
    color?: string
}

interface CategoryBreakdownProps {
    byGroup: Record<string, number>
    totalKg: number
}

const GROUP_COLORS: Record<string, string> = {
    Energy:    '#f59e0b',
    Transport: '#3b82f6',
    Food:      '#22c55e',
    Waste:     '#8b5cf6',
    Nature:    '#10b981',
    Lifestyle: '#ec4899',
}

const GROUP_EMOJIS: Record<string, string> = {
    Energy:    '⚡',
    Transport: '🚲',
    Food:      '🥗',
    Waste:     '♻️',
    Nature:    '🌳',
    Lifestyle: '💚',
}

export function CategoryBreakdown({ byGroup, totalKg }: CategoryBreakdownProps) {
    const categories: CategoryData[] = useMemo(() =>
        Object.entries(byGroup)
            .map(([name, kg_co2]) => ({
                name,
                kg_co2,
                color: GROUP_COLORS[name] ?? '#6b7280',
            }))
            .sort((a, b) => b.kg_co2 - a.kg_co2),
        [byGroup]
    )

    if (categories.length === 0) {
        return (
            <div style={{
                padding: '2rem', textAlign: 'center',
                color: '#9ca3af', fontSize: '0.85rem',
            }}>
                No category data yet. Start verifying eco actions!
            </div>
        )
    }

    const maxKg = categories[0]?.kg_co2 ?? 1

    return (
        <div>
            {/* Donut / stacked bar */}
            <div style={{
                display: 'flex', height: 16, borderRadius: 99,
                overflow: 'hidden', marginBottom: 20,
            }}>
                {categories.map(cat => (
                    <div
                        key={cat.name}
                        title={`${cat.name}: ${cat.kg_co2} kg CO₂`}
                        style={{
                            flex: cat.kg_co2 / totalKg,
                            background: cat.color,
                            transition: 'flex 0.6s ease',
                        }}
                    />
                ))}
            </div>

            {/* Category rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {categories.map(cat => {
                    const pct = totalKg > 0
                        ? Math.round((cat.kg_co2 / totalKg) * 100)
                        : 0
                    const barWidth = maxKg > 0 ? (cat.kg_co2 / maxKg) * 100 : 0

                    return (
                        <div key={cat.name}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 4,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '0.9rem' }}>{GROUP_EMOJIS[cat.name] ?? '🌿'}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>
                                        {cat.name}
                                    </span>
                                    <span style={{
                                        fontSize: '0.67rem', fontWeight: 700,
                                        color: cat.color,
                                        background: `${cat.color}18`,
                                        padding: '1px 5px', borderRadius: 4,
                                    }}>
                                        {pct}%
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '0.78rem', fontWeight: 700, color: '#374151',
                                }}>
                                    {cat.kg_co2 >= 1000
                                        ? `${(cat.kg_co2 / 1000).toFixed(1)} t`
                                        : `${cat.kg_co2.toFixed(1)} kg`} CO₂
                                </span>
                            </div>
                            <div style={{
                                height: 6, borderRadius: 99,
                                background: 'rgba(0,0,0,0.07)',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%', borderRadius: 99,
                                    width: `${barWidth}%`,
                                    background: `linear-gradient(90deg, ${cat.color}66, ${cat.color})`,
                                    transition: 'width 0.7s ease',
                                }} />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Total */}
            <div style={{
                marginTop: 16, paddingTop: 12,
                borderTop: '1px solid rgba(0,0,0,0.07)',
                display: 'flex', justifyContent: 'space-between',
                fontSize: '0.82rem',
            }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>Total CO₂ Offset</span>
                <span style={{ color: '#111827', fontWeight: 800 }}>
                    {totalKg >= 1000
                        ? `${(totalKg / 1000).toFixed(2)} tonnes`
                        : `${totalKg.toFixed(1)} kg`}
                </span>
            </div>
        </div>
    )
}
