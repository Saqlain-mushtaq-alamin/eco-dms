import { useQuery } from '@apollo/client'
import { ethers } from 'ethers'
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

    if (loading) {
        return {
            lifetimeEarned: '0',
            todayEarned: '0',
            totalClaims: 0,
            lastClaimTime: null,
            loading: true,
            error: null,
        }
    }

    if (error) {
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

    // Calculate lifetime earned (convert from wei to tokens)
    const lifetimeEarned = user?.totalEcoRewards
        ? ethers.formatEther(user.totalEcoRewards)
        : '0'

    // Calculate today's earned (sum of today's rewards)
    const todayEarned = data?.todayRewards?.length > 0
        ? ethers.formatEther(
            data.todayRewards.reduce(
                (sum: bigint, reward: any) => sum + BigInt(reward.amount),
                BigInt(0)
            ).toString()
        )
        : '0'

    // Total claims (total verifications)
    const totalClaims = user?.totalEcoVerifications
        ? parseInt(user.totalEcoVerifications.toString())
        : 0

    // Last claim time (convert from timestamp to ISO string)
    const lastClaimTime = user?.lastRewardTime
        ? new Date(parseInt(user.lastRewardTime.toString()) * 1000).toISOString()
        : null

    return {
        lifetimeEarned,
        todayEarned,
        totalClaims,
        lastClaimTime,
        loading: false,
        error: null,
    }
}
