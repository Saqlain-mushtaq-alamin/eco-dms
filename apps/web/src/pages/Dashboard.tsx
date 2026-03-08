import React, { useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { useTokenBalanceFromGraph } from '../hooks/useTokenBalanceFromGraph'
import { useEarningsFromGraph } from '../hooks/useEarningsFromGraph'
import { REWARD_TOKEN_SYMBOL, REWARD_TOKEN_ICON, REWARD_TOKEN_DECIMALS, CONTRACTS } from '../config/contracts'
import { VERIFICATION_ABI } from '../config/abis'

interface DashboardProps {
    address: string
    onBack: () => void
}

type Post = {
    cid?: string
    content: string
    created_at: string
    verified?: boolean
    eco_score?: number
    verification_status?: 'pending' | 'verified' | 'none'
}

type ClaimPayloadResponse = {
    post_cid: string
    chain_verdict: {
        postCid: string
        isEco: boolean
        confidence: number
        timestamp: number
        nonce: number | string
        wallet: string
    }
    signature: string
    verifier_address: string
}

export function Dashboard({ address, onBack }: DashboardProps) {
    const { balance, loading: balanceLoading, error: balanceError, refresh } = useTokenBalanceFromGraph(address)
    const { lifetimeEarned, todayEarned, totalClaims, loading: earningsLoading } = useEarningsFromGraph(address)
    const [ecoPosts, setEcoPosts] = useState<Post[]>([])
    const [loadingPosts, setLoadingPosts] = useState(false)
    const [claimingPosts, setClaimingPosts] = useState<Record<string, boolean>>({})
    const [claimedPosts, setClaimedPosts] = useState<Set<string>>(new Set())
    const [claimError, setClaimError] = useState<string | null>(null)
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

    const ensureCorrectNetwork = async () => {
        const targetChainId = Number(import.meta.env.VITE_CHAIN_ID ?? 31337)
        const targetHex = `0x${targetChainId.toString(16)}`

        if (!(window as any).ethereum) {
            throw new Error('MetaMask not found')
        }

        const provider = new ethers.BrowserProvider((window as any).ethereum)
        const network = await provider.getNetwork()
        if (Number(network.chainId) === targetChainId) {
            return provider
        }

        try {
            await (window as any).ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetHex }],
            })
        } catch (switchError: any) {
            // 4902 or wallet-specific unknown chain error: add chain then switch.
            const msg = String(switchError?.message || '').toLowerCase()
            if (switchError?.code === 4902 || msg.includes('unrecognized chain') || msg.includes('unknown chain')) {
                await (window as any).ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: targetHex,
                        chainName: 'Hardhat Local',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: [import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545'],
                        blockExplorerUrls: [],
                    }],
                })
                await (window as any).ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetHex }],
                })
            } else {
                throw switchError
            }
        }

        return new ethers.BrowserProvider((window as any).ethereum)
    }

    const loadEcoPosts = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setEcoPosts([])
            return
        }

        setLoadingPosts(true)
        setClaimError(null)
        try {
            const res = await fetch(`${apiBase}/api/posts/${address}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) {
                throw new Error(`Failed to load posts: ${res.status}`)
            }

            const data = await res.json() as { posts?: Post[] }
            const posts = data.posts || []
            const ownEcoPosts = posts.filter((p) => p.cid && p.verification_status === 'verified' && p.verified)
            setEcoPosts(ownEcoPosts)

            if ((window as any).ethereum && ownEcoPosts.length > 0) {
                try {
                    const provider = await ensureCorrectNetwork()
                    const contract = new ethers.Contract(CONTRACTS.verification.address, VERIFICATION_ABI, provider)
                    const claimed = new Set<string>()
                    await Promise.all(
                        ownEcoPosts.map(async (post) => {
                            if (!post.cid) return
                            const rewarded = await contract.isPostRewarded(post.cid)
                            if (rewarded) claimed.add(post.cid)
                        })
                    )
                    setClaimedPosts(claimed)
                } catch {
                    // Non-fatal: still show posts even if chain status check fails.
                }
            }
        } catch (err: any) {
            setClaimError(err?.message || 'Failed to load eco posts')
        } finally {
            setLoadingPosts(false)
        }
    }

    useEffect(() => {
        loadEcoPosts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address])

    const handleClaimReward = async (post: Post) => {
        if (!post.cid) return
        const postCid = post.cid

        setClaimingPosts(prev => ({ ...prev, [postCid]: true }))
        setClaimError(null)

        try {
            const provider = await ensureCorrectNetwork()
            const signer = await provider.getSigner()
            const contract = new ethers.Contract(CONTRACTS.verification.address, VERIFICATION_ABI, signer)

            const alreadyRewarded = await contract.isPostRewarded(postCid)
            if (alreadyRewarded) {
                setClaimedPosts(prev => new Set(prev).add(postCid))
                return
            }

            const payloadRes = await fetch(`${apiBase}/api/verify/claim-payload/${postCid}`)
            if (!payloadRes.ok) {
                const text = await payloadRes.text()
                throw new Error(text || `Failed to get claim payload: ${payloadRes.status}`)
            }

            const payload = await payloadRes.json() as ClaimPayloadResponse
            const verifierOk = await contract.isAuthorizedVerifier(payload.verifier_address)
            if (!verifierOk) {
                throw new Error('Verifier not authorized on contract')
            }

            const v = payload.chain_verdict
            const verdictForContract = {
                postCid: v.postCid,
                isEco: Boolean(v.isEco),
                confidence: BigInt(v.confidence),
                timestamp: BigInt(v.timestamp),
                nonce: BigInt(v.nonce),
                wallet: v.wallet,
            }

            const tx = await contract.verifyAndReward(verdictForContract, payload.signature)
            await tx.wait()

            try {
                await fetch(
                    `${apiBase}/api/verify/claim/record?wallet_address=${encodeURIComponent(address)}&post_cid=${encodeURIComponent(postCid)}&amount=5&tx_hash=${encodeURIComponent(tx.hash)}`,
                    { method: 'POST' }
                )
            } catch {
                // Non-fatal bookkeeping failure.
            }

            setClaimedPosts(prev => new Set(prev).add(postCid))
            refresh()
        } catch (err: any) {
            setClaimError(err?.shortMessage || err?.message || 'Failed to claim reward')
        } finally {
            setClaimingPosts(prev => ({ ...prev, [postCid]: false }))
        }
    }

    const sortedEcoPosts = useMemo(
        () => [...ecoPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        [ecoPosts]
    )

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

                {/* Claim Rewards Section */}
                <div className="bg-white rounded-xl p-6 shadow-lg mt-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>🧾</span>
                        Claim Rewards For Your ECO Posts
                    </h3>

                    {claimError && (
                        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {claimError}
                        </div>
                    )}

                    {loadingPosts ? (
                        <div className="text-gray-500">Loading your eco posts...</div>
                    ) : sortedEcoPosts.length === 0 ? (
                        <div className="text-gray-500 text-sm">No verified ECO posts available to claim yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {sortedEcoPosts.map((post) => {
                                const postCid = post.cid || ''
                                const isClaimed = claimedPosts.has(postCid)
                                const isClaiming = Boolean(claimingPosts[postCid])

                                return (
                                    <div key={postCid} className="rounded-lg border border-gray-200 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-sm text-gray-900 line-clamp-2">{post.content || '(No text content)'}</p>
                                                <p className="mt-1 text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
                                                <p className="mt-1 text-xs text-emerald-700">Confidence: {Math.round((post.eco_score || 0) * 100)}%</p>
                                            </div>
                                            <button
                                                onClick={() => handleClaimReward(post)}
                                                disabled={isClaimed || isClaiming}
                                                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${isClaimed
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default'
                                                    : isClaiming
                                                        ? 'border-slate-300 bg-slate-100 text-slate-500 cursor-wait'
                                                        : 'border-lime-300 bg-lime-50 text-lime-800 hover:bg-lime-100'
                                                    }`}
                                            >
                                                {isClaimed ? 'Reward Claimed' : isClaiming ? 'Claiming...' : 'Claim 5 ECO'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
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
