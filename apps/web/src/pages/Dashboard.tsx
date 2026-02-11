import React from 'react'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useEarnings } from '../hooks/useEarnings'
import { REWARD_TOKEN_SYMBOL, REWARD_TOKEN_ICON, REWARD_TOKEN_DECIMALS, CONTRACTS } from '../config/contracts'

interface DashboardProps {
    address: string
    onBack: () => void
}

export function Dashboard({ address, onBack }: DashboardProps) {
    const { balance, loading: balanceLoading, error: balanceError, refresh } = useTokenBalance(address)
    const { lifetimeEarned, todayEarned, totalClaims, loading: earningsLoading } = useEarnings(address)

    const addTokenToWallet = async () => {
        try {
            if (!(window as any).ethereum) {
                alert('Please install MetaMask to add tokens to your wallet')
                return
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
            })

            if (wasAdded) {
                alert('✅ ECO token added to your wallet!')
            }
        } catch (error: any) {
            console.error('Failed to add token:', error)
            alert('Failed to add token to wallet')
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            🌱 ECO Dashboard
                        </h1>
                        <p className="text-gray-600 mt-1">Track your eco-friendly rewards</p>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                    >
                        ← Back to Feed
                    </button>
                </div>

                {/* Main Balance Card */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 text-white shadow-2xl mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm uppercase tracking-wide mb-2">Your ECO Balance</p>
                            {balanceLoading ? (
                                <div className="h-12 w-32 bg-white/20 animate-pulse rounded"></div>
                            ) : balanceError ? (
                                <p className="text-2xl">Error loading</p>
                            ) : (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-bold">{parseFloat(balance).toFixed(2)}</span>
                                    <span className="text-2xl font-semibold">{REWARD_TOKEN_SYMBOL}</span>
                                </div>
                            )}
                            <p className="text-green-100 text-sm mt-2">≈ ${(parseFloat(balance) * 1.5).toFixed(2)} USD</p>
                        </div>
                        <div className="text-6xl opacity-20">
                            🌍
                        </div>
                    </div>

                    {/* Add to Wallet Button */}
                    <button
                        onClick={addTokenToWallet}
                        className="mt-6 w-full bg-white text-green-600 font-semibold py-3 px-4 rounded-lg hover:bg-green-50 transition flex items-center justify-center gap-2"
                    >
                        <span>🦊</span>
                        Add ECO to Wallet
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Lifetime Earned */}
                    <div className="bg-white rounded-xl p-6 shadow-lg border-t-4 border-blue-500">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-gray-600 font-semibold">Lifetime Earned</h3>
                            <span className="text-2xl">📈</span>
                        </div>
                        {earningsLoading ? (
                            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
                        ) : (
                            <>
                                <p className="text-3xl font-bold text-gray-900">{lifetimeEarned} ECO</p>
                                <p className="text-sm text-gray-500 mt-1">{totalClaims} successful claims</p>
                            </>
                        )}
                    </div>

                    {/* Today Earned */}
                    <div className="bg-white rounded-xl p-6 shadow-lg border-t-4 border-yellow-500">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-gray-600 font-semibold">Today's Earnings</h3>
                            <span className="text-2xl">☀️</span>
                        </div>
                        {earningsLoading ? (
                            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
                        ) : (
                            <>
                                <p className="text-3xl font-bold text-gray-900">{todayEarned} ECO</p>
                                <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
                            </>
                        )}
                    </div>

                    {/* Rewards */}
                    <div className="bg-white rounded-xl p-6 shadow-lg border-t-4 border-purple-500">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-gray-600 font-semibold">Reward Rate</h3>
                            <span className="text-2xl">🎁</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">5 ECO</p>
                        <p className="text-sm text-gray-500 mt-1">Per verified post</p>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* How to Earn */}
                    <div className="bg-white rounded-xl p-6 shadow-lg">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span>💡</span>
                            How to Earn ECO
                        </h3>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="text-green-500 font-bold">1.</span>
                                <span className="text-gray-700">Create eco-friendly posts (solar panels, recycling, nature, etc.)</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-green-500 font-bold">2.</span>
                                <span className="text-gray-700">ML model verifies your post is eco-friendly</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-green-500 font-bold">3.</span>
                                <span className="text-gray-700">Click "Claim 5 ECO" button on verified posts</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-green-500 font-bold">4.</span>
                                <span className="text-gray-700">Receive tokens instantly to your wallet!</span>
                            </li>
                        </ul>
                    </div>

                    {/* Contract Info */}
                    <div className="bg-white rounded-xl p-6 shadow-lg">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span>📜</span>
                            Contract Information
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-500">Token Contract</p>
                                <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                                    {CONTRACTS.rewardToken.address}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Network</p>
                                <p className="text-sm font-semibold text-gray-900">Hardhat Local (Chain ID: 31337)</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Symbol</p>
                                    <p className="text-lg font-bold text-green-600">{REWARD_TOKEN_SYMBOL}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Decimals</p>
                                    <p className="text-lg font-bold text-gray-900">{REWARD_TOKEN_DECIMALS}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Refresh Button */}
                <div className="mt-6 text-center">
                    <button
                        onClick={refresh}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        🔄 Refresh Balance
                    </button>
                </div>
            </div>
        </div>
    )
}
