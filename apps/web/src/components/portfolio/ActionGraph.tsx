import React, { useMemo } from 'react'

interface DayCell {
    date: string
    count: number
    level: number       // 0-4
    co2_kg: number
    tooltip: string
}

interface WeekData {
    week_start: string
    days: DayCell[]
}

interface MonthLabel {
    month: string
    week_index: number
}

interface ActionGraphProps {
    weeks: WeekData[]
    monthLabels: MonthLabel[]
    totalActiveDays: number
    totalPosts: number
    peakDayCount: number
}

const LEVEL_COLORS = [
    '#eef2ef',  // 0 - empty
    '#bbf7d0',  // 1 - light green
    '#4ade80',  // 2 - medium green
    '#16a34a',  // 3 - dark green
    '#14532d',  // 4 - deepest green
]

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
const CELL_SIZE = 13
const CELL_GAP = 3

export function ActionGraph({
    weeks,
    monthLabels,
    totalActiveDays,
    totalPosts,
    peakDayCount,
}: ActionGraphProps) {
    const [hoveredCell, setHoveredCell] = React.useState<DayCell | null>(null)
    const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 })

    const gridWidth = weeks.length * (CELL_SIZE + CELL_GAP)

    if (!weeks || weeks.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                No activity yet — start posting eco actions to build your graph!
            </div>
        )
    }

    return (
        <div style={{ position: 'relative' }}>
            {/* Month labels */}
            <div style={{
                position: 'relative',
                height: 18,
                marginLeft: 32,
                marginBottom: 4,
                width: gridWidth,
            }}>
                {monthLabels.map((ml, i) => (
                    <span key={i} style={{
                        position: 'absolute',
                        left: ml.week_index * (CELL_SIZE + CELL_GAP),
                        fontSize: '0.65rem',
                        color: '#9ca3af',
                        fontWeight: 600,
                        userSelect: 'none',
                    }}>
                        {ml.month}
                    </span>
                ))}
            </div>

            {/* Main grid */}
            <div style={{ display: 'flex', gap: 0 }}>
                {/* Day-of-week labels */}
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: CELL_GAP,
                    marginRight: 4, justifyContent: 'flex-start',
                    paddingTop: 0,
                }}>
                    {DAY_LABELS.map((label, i) => (
                        <div key={i} style={{
                            height: CELL_SIZE,
                            fontSize: '0.6rem', color: '#9ca3af',
                            display: 'flex', alignItems: 'center',
                            userSelect: 'none', width: 24,
                        }}>
                            {label}
                        </div>
                    ))}
                </div>

                {/* Columns (one per week) */}
                <div style={{ display: 'flex', gap: CELL_GAP, overflowX: 'auto' }}>
                    {weeks.map((week, wi) => (
                        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP }}>
                            {week.days.map((day, di) => (
                                <div
                                    key={di}
                                    onMouseEnter={(e) => {
                                        setHoveredCell(day)
                                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                                        setTooltipPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 36 })
                                    }}
                                    onMouseLeave={() => setHoveredCell(null)}
                                    style={{
                                        width: CELL_SIZE, height: CELL_SIZE,
                                        borderRadius: 3,
                                        background: LEVEL_COLORS[day.level] ?? LEVEL_COLORS[0],
                                        cursor: day.count > 0 ? 'pointer' : 'default',
                                        transition: 'transform 0.1s, opacity 0.1s',
                                        opacity: hoveredCell && hoveredCell.date !== day.date ? 0.7 : 1,
                                        transform: hoveredCell?.date === day.date ? 'scale(1.3)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
                <div style={{
                    position: 'fixed',
                    left: tooltipPos.x,
                    top: tooltipPos.y,
                    background: 'rgba(17,24,39,0.93)',
                    color: '#fff',
                    padding: '5px 10px',
                    borderRadius: 7,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 9999,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                    {hoveredCell.tooltip}
                </div>
            )}

            {/* Legend + stats */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 10, flexWrap: 'wrap', gap: 8,
            }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    <strong style={{ color: '#374151' }}>{totalActiveDays}</strong> active days ·{' '}
                    <strong style={{ color: '#374151' }}>{totalPosts}</strong> total posts ·{' '}
                    Peak: <strong style={{ color: '#374151' }}>{peakDayCount}</strong>/day
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: '#9ca3af' }}>
                    <span>Less</span>
                    {LEVEL_COLORS.map((c, i) => (
                        <div key={i} style={{
                            width: 11, height: 11, borderRadius: 2,
                            background: c, border: '1px solid rgba(0,0,0,0.1)',
                        }} />
                    ))}
                    <span>More</span>
                </div>
            </div>
        </div>
    )
}
