import React from 'react'

interface LevelData {
    level: number
    title: string
    unlocks: string
    next_level: number
    actions_to_next: number
    co2_to_next: number
    actions_progress_pct: number
    co2_progress_pct: number
}

interface LevelProgressProps {
    levelData: LevelData
    compact?: boolean
}

const LEVEL_COLORS: Record<number, string> = {
    1:  '#64748b', 2: '#6b7280', 3: '#22c55e', 4: '#16a34a',
    5:  '#0ea5e9', 6: '#0284c7', 7: '#8b5cf6', 8: '#7c3aed',
    9:  '#f59e0b', 10: '#d97706', 11: '#ef4444', 12: '#dc2626',
    13: '#f97316', 14: '#ea580c', 15: '#ec4899', 16: '#db2777',
    17: '#14b8a6', 18: '#0d9488', 19: '#6366f1', 20: '#fbbf24',
}

function getLevelColor(level: number): string {
    return LEVEL_COLORS[level] ?? '#22c55e'
}

function ProgressBar({ value, color, label }: { value: number; color: string; label: string }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.72rem' }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{value.toFixed(0)}%</span>
            </div>
            <div style={{
                height: 7, borderRadius: 99,
                background: 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%',
                    width: `${Math.min(value, 100)}%`,
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transition: 'width 0.8s ease',
                }} />
            </div>
        </div>
    )
}

export function LevelProgress({ levelData, compact = false }: LevelProgressProps) {
    const color = getLevelColor(levelData.level)
    const isMaxLevel = levelData.level >= 20

    return (
        <div style={{
            background: `linear-gradient(135deg, ${color}12, transparent)`,
            border: `1.5px solid ${color}30`,
            borderRadius: 16,
            padding: compact ? '0.85rem 1rem' : '1.25rem 1.5rem',
        }}>
            {/* Level badge + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: compact ? 8 : 14 }}>
                <div style={{
                    width: compact ? 44 : 56, height: compact ? 44 : 56,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${color}, ${color}99)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${color}40`,
                }}>
                    <span style={{
                        fontSize: compact ? '1rem' : '1.25rem',
                        fontWeight: 900, color: '#fff',
                        fontFamily: 'Inter, sans-serif',
                    }}>
                        {levelData.level}
                    </span>
                </div>
                <div>
                    <div style={{
                        fontSize: compact ? '0.95rem' : '1.1rem',
                        fontWeight: 800, color: '#111827',
                    }}>
                        {levelData.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                        🔓 {levelData.unlocks}
                    </div>
                </div>
            </div>

            {/* Progress bars */}
            {!isMaxLevel && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ProgressBar
                        value={levelData.actions_progress_pct}
                        color={color}
                        label={`Actions to Level ${levelData.next_level}: ${levelData.actions_to_next} more`}
                    />
                    <ProgressBar
                        value={levelData.co2_progress_pct}
                        color={color}
                        label={`CO₂ to Level ${levelData.next_level}: ${levelData.co2_to_next} kg more`}
                    />
                </div>
            )}

            {isMaxLevel && (
                <div style={{
                    textAlign: 'center', padding: '0.5rem',
                    fontSize: '0.82rem', color, fontWeight: 700,
                }}>
                    🏆 Maximum level achieved — Earth Champion
                </div>
            )}
        </div>
    )
}
