import { useState, useEffect } from 'react'
import { API_BASE } from '../api'

interface EarningsData {
    lifetimeEarned: string
    todayEarned: string
    totalClaims: number
    lastClaimTime: string | null
    loading: boolean
    error: string | null
}

export function useEarnings(walletAddress: string | null): EarningsData {
    const [data, setData] = useState<EarningsData>({
        lifetimeEarned: '0',
        todayEarned: '0',
        totalClaims: 0,
        lastClaimTime: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        let cancelled = false

        async function fetchEarnings() {
            if (!walletAddress) {
                setData({
                    lifetimeEarned: '0',
                    todayEarned: '0',
                    totalClaims: 0,
                    lastClaimTime: null,
                    loading: false,
                    error: null,
                })
                return
            }

            try {
                const token = localStorage.getItem('auth_token')
                if (!token) {
                    throw new Error('No authentication token')
                }

                const res = await fetch(`${API_BASE}/api/verify/earnings/${walletAddress}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                })

                if (!res.ok) {
                    throw new Error(`Failed to fetch earnings: ${res.status}`)
                }

                const result = await res.json()

                if (!cancelled) {
                    setData({
                        lifetimeEarned: result.lifetime_earned || '0',
                        todayEarned: result.today_earned || '0',
                        totalClaims: result.total_claims || 0,
                        lastClaimTime: result.last_claim_time || null,
                        loading: false,
                        error: null,
                    })
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Failed to fetch earnings:', err)
                    // If endpoint doesn't exist yet, show zeros instead of error
                    setData({
                        lifetimeEarned: '0',
                        todayEarned: '0',
                        totalClaims: 0,
                        lastClaimTime: null,
                        loading: false,
                        error: null, // Don't show error for missing endpoint
                    })
                }
            }
        }

        fetchEarnings()

        // Refresh every 30 seconds
        const interval = setInterval(fetchEarnings, 30000)

        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [walletAddress])

    return data
}
