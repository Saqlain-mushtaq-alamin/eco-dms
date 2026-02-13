import { useQuery } from '@apollo/client'
import { ethers } from 'ethers'
import { GET_USER_BALANCE } from '../graphql/dashboardQueries'

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
    const { data, loading, error, refetch } = useQuery(GET_USER_BALANCE, {
        variables: {
            wallet: address?.toLowerCase() || '',
        },
        skip: !address,
        pollInterval: 10000, // Poll every 10 seconds
    })

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
        return {
            balance: '0',
            loading: false,
            error: error.message,
            refresh,
        }
    }

    const balance = data?.user?.tokenBalance
        ? ethers.formatEther(data.user.tokenBalance)
        : '0'

    return {
        balance,
        loading: false,
        error: null,
        refresh,
    }
}
