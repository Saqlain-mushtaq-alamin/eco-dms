import { useQuery } from '@apollo/client';
import { GET_DASHBOARD } from '../graphql/queries';
import { useMemo } from 'react';

/**
 * DASHBOARD HOOK - Complete dashboard data from The Graph
 * Replaces multiple backend API calls with single GraphQL query
 */

export interface DashboardData {
    user: {
        id: string;
        handle?: string;
        tokenBalance: string;
        totalEcoVerifications: string;
        totalEcoRewards: string;
        totalPosts: string;
        recentPosts: any[];
        allRewards: any[];
        todayRewards: string;
    };
    stats: {
        totalUsers: string;
        totalPosts: string;
        totalEcoVerifiedPosts: string;
        totalRewardsMinted: string;
    };
}

/**
 * useDashboard - Get complete dashboard data in one query
 * 
 * OLD WAY (Multiple API calls):
 * - GET /api/users/me
 * - GET /api/verify/earnings/{wallet}
 * - GET /api/posts/{wallet}
 * - GET /api/stats
 * 
 * NEW WAY (Single Graph query):
 * - One GraphQL query gets everything
 * - Faster, less server load
 * - Data comes from blockchain (trustless)
 */
export function useDashboard(walletAddress: string | null) {
    const userId = walletAddress?.toLowerCase();

    // Calculate 24 hours ago
    const timestamp24hAgo = useMemo(() => {
        return Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    }, []);

    const { data, loading, error, refetch } = useQuery(GET_DASHBOARD, {
        variables: { userId, timestamp24hAgo },
        skip: !userId,
        pollInterval: 30000, // Refresh every 30 seconds
    });

    const dashboardData = useMemo<DashboardData | null>(() => {
        if (!data?.user) return null;

        const { user, globalStats } = data;

        // Calculate today's rewards
        const todayTotal = user.recentRewards?.reduce((sum: bigint, reward: any) => {
            return sum + BigInt(reward.amount);
        }, BigInt(0)) || BigInt(0);

        return {
            user: {
                id: user.id,
                handle: user.handle,
                tokenBalance: user.tokenBalance,
                totalEcoVerifications: user.totalEcoVerifications,
                totalEcoRewards: user.totalEcoRewards,
                totalPosts: user.totalPosts,
                recentPosts: user.posts || [],
                allRewards: user.rewards || [],
                todayRewards: todayTotal.toString(),
            },
            stats: globalStats || {
                totalUsers: '0',
                totalPosts: '0',
                totalEcoVerifiedPosts: '0',
                totalRewardsMinted: '0',
            },
        };
    }, [data]);

    return {
        dashboardData,
        loading,
        error,
        refetch,
    };
}

/**
 * Format ECO tokens from wei
 */
export function formatECO(amount: string): string {
    try {
        const wei = BigInt(amount);
        const eco = Number(wei) / 1e18;
        return eco.toFixed(2);
    } catch {
        return '0.00';
    }
}
