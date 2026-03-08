import { useQuery } from '@apollo/client'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { GET_USER_EARNINGS } from '../graphql/dashboardQueries'

interface EarningsData {
    lifetimeEarned: string
    todayEarned: string
    totalClaims: number
    lastClaimTime: string | null
    loading: boolean
    error: string | null
}

/**
 * Hook to get user earnings from The Graph
 * Uses GraphQL instead of backend API
 */
export function useEarningsFromGraph(walletAddress: string | null): EarningsData {
    const [backendEarnings, setBackendEarnings] = useState<{
        lifetimeEarned: string
        todayEarned: string
        totalClaims: number
        lastClaimTime: string | null
        error: string | null
    } | null>(null)

    // Get timestamp for start of today (UTC)
    const getTodayStart = () => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return Math.floor(todayStart.getTime() / 1000).toString()
    }

    const { data, loading, error } = useQuery(GET_USER_EARNINGS, {
        variables: {
            wallet: walletAddress?.toLowerCase() || '',
            todayStart: getTodayStart(),
        },
        skip: !walletAddress,
        pollInterval: 10000, // Poll every 10 seconds
    })

    useEffect(() => {
        if (!walletAddress) {
            setBackendEarnings(null)
            return
        }

        let cancelled = false
        const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

        const fetchBackendEarnings = async () => {
            try {
                const res = await fetch(`${apiBase}/api/verify/earnings/${walletAddress.toLowerCase()}`)
                if (!res.ok) {
                    throw new Error(`Backend earnings request failed: ${res.status}`)
                }

                const payload = await res.json()
                if (cancelled) return

                setBackendEarnings({
                    lifetimeEarned: String(payload?.lifetime_earned ?? '0'),
                    todayEarned: String(payload?.today_earned ?? '0'),
                    totalClaims: Number(payload?.total_claims ?? 0),
                    lastClaimTime: payload?.last_claim_time ?? null,
                    error: null,
                })
            } catch (err: any) {
                if (cancelled) return
                setBackendEarnings({
                    lifetimeEarned: '0',
                    todayEarned: '0',
                    totalClaims: 0,
                    lastClaimTime: null,
                    error: err?.message || 'Failed to fetch backend earnings',
                })
            }
        }

        fetchBackendEarnings()
        const timer = setInterval(fetchBackendEarnings, 10000)

        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [walletAddress])

    if (!walletAddress) {
        return {
            lifetimeEarned: '0',
            todayEarned: '0',
            totalClaims: 0,
            lastClaimTime: null,
            loading: false,
            error: null,
        }
    }

    if (loading && !backendEarnings) {
        return {
            lifetimeEarned: '0',
            todayEarned: '0',
            totalClaims: 0,
            lastClaimTime: null,
            loading: true,
            error: null,
        }
    }

    if (error && !backendEarnings) {
        console.error('Error fetching earnings from The Graph:', error)
        return {
            lifetimeEarned: '0',
            todayEarned: '0',
            totalClaims: 0,
            lastClaimTime: null,
            loading: false,
            error: error.message,
        }
    }

    const user = data?.user
    const graphData = {
        lifetimeEarned: user?.totalEcoRewards
            ? ethers.formatEther(user.totalEcoRewards)
            : '0',
        todayEarned: data?.todayRewards?.length > 0
            ? ethers.formatEther(
                data.todayRewards.reduce(
                    (sum: bigint, reward: any) => sum + BigInt(reward.amount),
                    BigInt(0)
                ).toString()
            )
            : '0',
        totalClaims: user?.totalEcoVerifications
            ? parseInt(user.totalEcoVerifications.toString())
            : 0,
        lastClaimTime: user?.lastRewardTime
            ? new Date(parseInt(user.lastRewardTime.toString()) * 1000).toISOString()
            : null,
    }

    const graphHasRewards = Number(graphData.lifetimeEarned) > 0 || graphData.totalClaims > 0
    const backendHasRewards = backendEarnings && (Number(backendEarnings.lifetimeEarned) > 0 || backendEarnings.totalClaims > 0)

    const effective = graphHasRewards || !backendHasRewards
        ? graphData
        : {
            lifetimeEarned: backendEarnings?.lifetimeEarned ?? '0',
            todayEarned: backendEarnings?.todayEarned ?? '0',
            totalClaims: backendEarnings?.totalClaims ?? 0,
            lastClaimTime: backendEarnings?.lastClaimTime ?? null,
        }

    return {
        lifetimeEarned: effective.lifetimeEarned,
        todayEarned: effective.todayEarned,
        totalClaims: effective.totalClaims,
        lastClaimTime: effective.lastClaimTime,
        loading: loading && !graphHasRewards && !backendHasRewards,
        error: error?.message || backendEarnings?.error || null,
    }
}
