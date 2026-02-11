import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { CONTRACTS } from '../config/contracts'
import { REWARD_TOKEN_ABI } from '../config/abis'

interface TokenBalance {
    balance: string
    loading: boolean
    error: string | null
    refresh: () => void
}

export function useTokenBalance(address: string | null): TokenBalance {
    const [balance, setBalance] = useState('0')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshCounter, setRefreshCounter] = useState(0)

    const refresh = () => setRefreshCounter(prev => prev + 1)

    useEffect(() => {
        let cancelled = false

        async function fetchBalance() {
            if (!address) {
                setBalance('0')
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
                const tokenContract = new ethers.Contract(
                    CONTRACTS.rewardToken.address,
                    REWARD_TOKEN_ABI,
                    provider
                )

                const rawBalance = await tokenContract.balanceOf(address)

                if (!cancelled) {
                    const formatted = ethers.formatEther(rawBalance)
                    setBalance(formatted)
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Failed to fetch token balance:', err)
                    setError(err.message || 'Failed to fetch balance')
                    setBalance('0')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchBalance()

        // Refresh every 10 seconds
        const interval = setInterval(fetchBalance, 10000)

        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [address, refreshCounter])

    return { balance, loading, error, refresh }
}
