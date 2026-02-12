import React from 'react';
import { useDashboard, formatECO } from '../hooks/useDashboardGraph';

/**
 * EXAMPLE: Dashboard using The Graph
 * 
 * OLD FLOW (Multiple API calls):
 * - GET /api/users/me
 * - GET /api/verify/earnings/{wallet}
 * - GET /api/posts/{wallet}
 * - Total: 3+ API calls, ~500ms
 * 
 * NEW FLOW (Single Graph query):
 * - One GraphQL query
 * - Total: 1 request, ~100ms
 * - Data from blockchain (trustless)
 * 
 * @param walletAddress - The connected wallet address (pass from parent component)
 */

export function DashboardExample({ walletAddress }: { walletAddress?: string }) {
    const address = walletAddress || null;
    const { dashboardData, loading, error } = useDashboard(address);

    if (loading) {
        return <div className="text-center py-8">Loading dashboard from The Graph...</div>;
    }

    if (error) {
        return (
            <div className="text-center py-8 text-red-600">
                Error loading dashboard: {error.message}
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="text-center py-8">
                <p>Connect your wallet to view dashboard</p>
            </div>
        );
    }

    const { user, stats } = dashboardData;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">🌱 Dashboard</h1>
            <p className="text-sm text-gray-600 mb-6">
                All data from The Graph (blockchain source of truth)
            </p>

            {/* User Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* ECO Balance */}
                <div className="bg-white border rounded-lg p-6">
                    <p className="text-sm text-gray-600 mb-2">ECO Balance</p>
                    <p className="text-3xl font-bold text-green-600">
                        {formatECO(user.tokenBalance)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">On-chain balance</p>
                </div>

                {/* Lifetime Earned */}
                <div className="bg-white border rounded-lg p-6">
                    <p className="text-sm text-gray-600 mb-2">Lifetime Earned</p>
                    <p className="text-3xl font-bold text-blue-600">
                        {formatECO(user.totalEcoRewards)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Total rewards</p>
                </div>

                {/* Today Earned */}
                <div className="bg-white border rounded-lg p-6">
                    <p className="text-sm text-gray-600 mb-2">Today Earned</p>
                    <p className="text-3xl font-bold text-purple-600">
                        {formatECO(user.todayRewards)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
                </div>

                {/* Verifications */}
                <div className="bg-white border rounded-lg p-6">
                    <p className="text-sm text-gray-600 mb-2">Eco Verifications</p>
                    <p className="text-3xl font-bold text-orange-600">
                        {user.totalEcoVerifications}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Posts verified</p>
                </div>
            </div>

            {/* Recent Eco Posts */}
            <div className="bg-white border rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">🌿 Recent Eco-Verified Posts</h2>
                {user.recentPosts.length > 0 ? (
                    <div className="space-y-3">
                        {user.recentPosts.map((post: any) => (
                            <div
                                key={post.id}
                                className="flex justify-between items-center py-3 border-b last:border-0"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        Post {post.contentCID.slice(0, 12)}...
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(parseInt(post.timestamp) * 1000).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                        ✓ {post.ecoConfidence}% confident
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">
                        No eco-verified posts yet. Create eco-friendly content to earn rewards!
                    </p>
                )}
            </div>

            {/* Recent Rewards */}
            <div className="bg-white border rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">💰 Recent Rewards</h2>
                {user.allRewards.length > 0 ? (
                    <div className="space-y-3">
                        {user.allRewards.slice(0, 5).map((reward: any) => (
                            <div
                                key={reward.id}
                                className="flex justify-between items-center py-3 border-b last:border-0"
                            >
                                <div>
                                    <p className="text-sm font-medium">{formatECO(reward.amount)} ECO</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(parseInt(reward.timestamp) * 1000).toLocaleDateString()}
                                    </p>
                                </div>
                                <a
                                    href={`https://etherscan.io/tx/${reward.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    View TX →
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">No rewards yet</p>
                )}
            </div>

            {/* Platform Stats */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">📊 Platform Stats</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-2xl font-bold">{stats.totalUsers}</p>
                        <p className="text-xs text-gray-600">Total Users</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{stats.totalPosts}</p>
                        <p className="text-xs text-gray-600">Total Posts</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{stats.totalEcoVerifiedPosts}</p>
                        <p className="text-xs text-gray-600">Eco Posts</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">
                            {formatECO(stats.totalRewardsMinted)}
                        </p>
                        <p className="text-xs text-gray-600">ECO Distributed</p>
                    </div>
                </div>
            </div>

            {/* Data Source */}
            <p className="text-center text-xs text-gray-400 mt-6">
                All data sourced from The Graph (blockchain verified)
                <br />
                Auto-refreshes every 30 seconds
            </p>
        </div>
    );
}
