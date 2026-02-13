import React from 'react';
import { useDashboard, formatECO } from '../hooks/useDashboardGraph';
import { REWARD_TOKEN_SYMBOL, REWARD_TOKEN_ICON, REWARD_TOKEN_DECIMALS, CONTRACTS } from '../config/contracts';

/**
 * Dashboard Component using The Graph
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
 */

interface DashboardProps {
    address: string;
    onBack: () => void;
}

export function Dashboard({ address, onBack }: DashboardProps) {
    const { dashboardData, loading, error } = useDashboard(address);

    const addTokenToWallet = async () => {
        try {
            if (!(window as any).ethereum) {
                alert('Please install MetaMask to add tokens to your wallet');
                return;
            }

            const wasAdded = await (window as any).ethereum.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: CONTRACTS.rewardToken.address,
                        symbol: REWARD_TOKEN_SYMBOL,
                        decimals: REWARD_TOKEN_DECIMALS,
                        image: REWARD_TOKEN_ICON,
                    },
                },
            });

            if (wasAdded) {
                alert('✅ ECO token added to your wallet!');
            }
        } catch (error: any) {
            console.error('Failed to add token:', error);
            alert('Failed to add token to wallet');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading dashboard from The Graph...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                        ← Back
                    </button>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <p className="text-red-600 font-semibold mb-2">Failed to load dashboard</p>
                        <p className="text-red-500 text-sm">{error.message}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!dashboardData || !dashboardData.user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                        ← Back
                    </button>
                    <div className="bg-white rounded-lg border p-8 text-center">
                        <p className="text-gray-600">No data found for this wallet</p>
                        <p className="text-sm text-gray-500 mt-2">Create some eco-friendly posts to get started!</p>
                    </div>
                </div>
            </div>
        );
    }

    const { user, stats } = dashboardData;

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-2"
                        >
                            ← Back
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            🌱 Your Eco Dashboard
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            {address.slice(0, 6)}...{address.slice(-4)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Reading from</p>
                        <p className="text-sm font-medium text-green-600">📊 The Graph</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* ECO Balance - Prominent Card */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 border-0 text-white md:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium opacity-90">🌱 ECO Balance</p>
                            <button
                                onClick={addTokenToWallet}
                                className="px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-xs font-medium transition backdrop-blur-sm"
                                title="Add ECO token to your wallet"
                            >
                                + Add to Wallet
                            </button>
                        </div>
                        <p className="text-5xl font-bold mb-4">
                            {formatECO(user.tokenBalance)}
                        </p>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white border-opacity-20">
                            <div>
                                <p className="text-xs opacity-80">Lifetime Earned</p>
                                <p className="text-xl font-bold">{formatECO(user.totalEcoRewards)}</p>
                            </div>
                            <div>
                                <p className="text-xs opacity-80">Today Earned</p>
                                <p className="text-xl font-bold">{formatECO(user.todayRewards || '0')}</p>
                            </div>
                        </div>
                        <p className="text-xs opacity-75 mt-3">
                            Token: {CONTRACTS.rewardToken.address.slice(0, 10)}...{CONTRACTS.rewardToken.address.slice(-8)}
                        </p>
                    </div>

                    {/* Verifications */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border border-orange-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-600">Eco Verifications</p>
                            <span className="text-2xl">✓</span>
                        </div>
                        <p className="text-3xl font-bold text-orange-600">
                            {user.totalEcoVerifications}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Posts verified</p>
                    </div>

                    {/* Total Posts */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-600">Total Posts</p>
                            <span className="text-2xl">📝</span>
                        </div>
                        <p className="text-3xl font-bold text-blue-600">
                            {user.totalPosts || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">All time posts</p>
                    </div>
                </div>

                {/* Recent Eco Posts */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        🌿 Recent Eco-Verified Posts
                    </h2>
                    {user.recentPosts && user.recentPosts.length > 0 ? (
                        <div className="space-y-3">
                            {user.recentPosts.map((post: any) => (
                                <div
                                    key={post.id}
                                    className="flex justify-between items-center py-3 border-b last:border-0 hover:bg-green-50 px-2 rounded transition"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            Post {post.contentCID.slice(0, 12)}...
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(parseInt(post.timestamp) * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                            ✓ {post.ecoConfidence || '95'}% confident
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
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        💰 Recent Rewards
                    </h2>
                    {user.allRewards && user.allRewards.length > 0 ? (
                        <div className="space-y-3">
                            {user.allRewards.slice(0, 5).map((reward: any) => (
                                <div
                                    key={reward.id}
                                    className="flex justify-between items-center py-3 border-b last:border-0 hover:bg-blue-50 px-2 rounded transition"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            +{formatECO(reward.amount)} ECO
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(parseInt(reward.timestamp) * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <a
                                        href={`https://etherscan.io/tx/${reward.transactionHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        View TX
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No rewards yet. Keep creating eco-friendly content!</p>
                    )}
                </div>

                {/* Platform Stats */}
                <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        📊 Platform Stats
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white bg-opacity-70 rounded-lg p-4">
                            <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                            <p className="text-xs text-gray-600">Total Users</p>
                        </div>
                        <div className="bg-white bg-opacity-70 rounded-lg p-4">
                            <p className="text-2xl font-bold text-gray-900">{stats?.totalPosts || 0}</p>
                            <p className="text-xs text-gray-600">Total Posts</p>
                        </div>
                        <div className="bg-white bg-opacity-70 rounded-lg p-4">
                            <p className="text-2xl font-bold text-gray-900">{stats?.totalEcoVerifiedPosts || 0}</p>
                            <p className="text-xs text-gray-600">Eco Posts</p>
                        </div>
                        <div className="bg-white bg-opacity-70 rounded-lg p-4">
                            <p className="text-2xl font-bold text-gray-900">
                                {formatECO(stats?.totalRewardsMinted || '0')}
                            </p>
                            <p className="text-xs text-gray-600">ECO Distributed</p>
                        </div>
                    </div>
                </div>

                {/* Data Source Footer */}
                <p className="text-center text-xs text-gray-500 mt-6">
                    📊 All data from The Graph (blockchain verified) • Auto-refreshes every 30 seconds
                </p>
            </div>
        </div>
    );
}
