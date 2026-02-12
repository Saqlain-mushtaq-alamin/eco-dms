import { useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { GET_USER_EARNINGS } from '../graphql/queries';

/**
 * EARNINGS HOOKS - Replace backend /api/verify/earnings/{wallet}
 * 
 * Uses The Graph to query on-chain reward data
 */

export interface Earnings {
    lifetime: string;
    today: string;
    totalClaims: number;
    lastClaimTime?: string;
    recentRewards: Array<{
        amount: string;
        timestamp: string;
        postCid: string;
        transactionHash: string;
    }>;
}

/**
 * useEarnings - Get user earnings from The Graph
 * Replaces: GET /api/verify/earnings/{wallet_address}
 */
export function useEarnings(walletAddress: string | null) {
    const userId = walletAddress?.toLowerCase();

    // Calculate 24 hours ago timestamp
    const timestamp24hAgo = useMemo(() => {
        return Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    }, []);

    const { data, loading, error, refetch } = useQuery(GET_USER_EARNINGS, {
        variables: { userId, timestamp24hAgo },
        skip: !userId,
        pollInterval: 30000, // Refresh every 30 seconds
    });

    const earnings = useMemo<Earnings>(() => {
        if (!data?.user) {
            return {
                lifetime: '0',
                today: '0',
                totalClaims: 0,
                recentRewards: [],
            };
        }

        const { totalEcoRewards, rewards, recentRewards } = data.user;

        // Calculate today's earnings from recent rewards
        const todayTotal = recentRewards.reduce((sum: bigint, reward: any) => {
            return sum + BigInt(reward.amount);
        }, BigInt(0));

        return {
            lifetime: totalEcoRewards,
            today: todayTotal.toString(),
            totalClaims: rewards.length,
            lastClaimTime: rewards[0]?.timestamp,
            recentRewards: rewards,
        };
    }, [data]);

    return {
        earnings,
        loading,
        error,
        refetch,
    };
}

/**
 * Format earnings amount from wei to ECO tokens
 */
export function formatEarnings(amount: string): string {
    try {
        const wei = BigInt(amount);
        const eco = Number(wei) / 1e18;
        return eco.toFixed(2);
    } catch {
        return '0.00';
    }
}
