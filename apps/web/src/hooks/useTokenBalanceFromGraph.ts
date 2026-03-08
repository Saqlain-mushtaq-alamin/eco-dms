import { useQuery } from '@apollo/client'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { GET_USER_BALANCE } from '../graphql/dashboardQueries'
import { CONTRACTS } from '../config/contracts'
import { REWARD_TOKEN_ABI } from '../config/abis'

interface TokenBalance {
    balance: string
    loading: boolean
    error: string | null
    refresh: () => void
}

/**
 * Hook to get user token balance from The Graph
 * Uses GraphQL instead of direct contract call
 * Faster and more decentralized than API
 */
export function useTokenBalanceFromGraph(address: string | null): TokenBalance {
    const [chainBalance, setChainBalance] = useState<string | null>(null)
    const [chainError, setChainError] = useState<string | null>(null)

    const { data, loading, error, refetch } = useQuery(GET_USER_BALANCE, {
        variables: {
            wallet: address?.toLowerCase() || '',
        },
        skip: !address,
        pollInterval: 10000, // Poll every 10 seconds
    })

    useEffect(() => {
        if (!address) {
            setChainBalance(null)
            setChainError(null)
            return
        }

        let cancelled = false

        const fetchChainBalance = async () => {
            try {
                if (!(window as any).ethereum) {
                    if (!cancelled) {
                        setChainBalance(null)
                        setChainError('No injected wallet provider found')
                    }
                    return
                }

                const provider = new ethers.BrowserProvider((window as any).ethereum)
                const contract = new ethers.Contract(
                    CONTRACTS.rewardToken.address,
                    REWARD_TOKEN_ABI,
                    provider
                )

                const rawBalance = await contract.balanceOf(address)
                if (cancelled) return

                setChainBalance(ethers.formatEther(rawBalance))
                setChainError(null)
            } catch (err: any) {
                if (cancelled) return
                setChainBalance(null)
                setChainError(err?.message || 'Failed to fetch on-chain balance')
            }
        }

        fetchChainBalance()
        const timer = setInterval(fetchChainBalance, 10000)

        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [address])

    const refresh = () => {
        refetch()
    }

    if (!address) {
        return {
            balance: '0',
            loading: false,
            error: null,
            refresh,
        }
    }

    if (loading && !data) {
        return {
            balance: '0',
            loading: true,
            error: null,
            refresh,
        }
    }

    if (error) {
        console.error('Error fetching balance from The Graph:', error)
        if (chainBalance !== null) {
            return {
                balance: chainBalance,
                loading: false,
                error: chainError,
                refresh,
            }
        }

        return {
            balance: '0',
            loading: false,
            error: error.message,
            refresh,
        }
    }

    const graphBalance = data?.user?.tokenBalance
        ? ethers.formatEther(data.user.tokenBalance)
        : '0'

    const balance = chainBalance !== null
        ? (Number(chainBalance) > 0 || Number(graphBalance) === 0 ? chainBalance : graphBalance)
        : graphBalance

    return {
        balance,
        loading: false,
        error: chainError,
        refresh,
    }
}
