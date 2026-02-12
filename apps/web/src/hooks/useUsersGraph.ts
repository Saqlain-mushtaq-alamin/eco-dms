import { useQuery } from '@apollo/client';
import { GET_USER_PROFILE, GET_LEADERBOARD, GET_ALL_USERS } from '../graphql/queries';

/**
 * USER HOOKS - Replace backend /api/users/* for READ operations
 * 
 * Uses The Graph to query on-chain user data and stats
 */

export interface User {
    id: string;
    handle?: string;
    totalPosts: string;
    totalEcoVerifications: string;
    totalEcoRewards: string;
    tokenBalance: string;
    lastRewardTime?: string;
    createdAt: string;
}

/**
 * useUserProfile - Get user profile from The Graph
 * Replaces: GET /api/users/me (for reading profile data)
 * Note: Still use /api/users/me for auth checks
 */
export function useUserProfile(walletAddress: string | null) {
    const userId = walletAddress?.toLowerCase();

    const { data, loading, error, refetch } = useQuery(GET_USER_PROFILE, {
        variables: { userId },
        skip: !userId,
    });

    return {
        user: data?.user,
        loading,
        error,
        refetch,
    };
}

/**
 * useLeaderboard - Get top earners
 * Replaces: GET /api/users/all?sort=rewards
 */
export function useLeaderboard(limit = 10) {
    const { data, loading, error } = useQuery(GET_LEADERBOARD, {
        variables: { first: limit },
    });

    return {
        users: data?.users || [],
        loading,
        error,
    };
}

/**
 * useAllUsers - Get all users (for discovery)
 * Replaces: GET /api/users/all
 */
export function useAllUsers(limit = 50) {
    const { data, loading, error, fetchMore } = useQuery(GET_ALL_USERS, {
        variables: { first: limit, skip: 0 },
    });

    const users = data?.users || [];

    const loadMore = () => {
        fetchMore({
            variables: { skip: users.length },
        });
    };

    return {
        users,
        loading,
        error,
        loadMore,
        hasMore: users.length % limit === 0,
    };
}

/**
 * Format token balance from wei to ECO
 */
export function formatTokenBalance(balance: string): string {
    try {
        const wei = BigInt(balance);
        const eco = Number(wei) / 1e18;
        return eco.toFixed(2);
    } catch {
        return '0.00';
    }
}
