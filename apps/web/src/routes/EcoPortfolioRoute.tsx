import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import EcoPortfolioPage from '../pages/EcoPortfolio'
import { getMe } from '../api'

/**
 * Route for viewing any user's Eco Portfolio.
 * Accessible at /portfolio/:address (public URL)
 */
export function EcoPortfolioRoute() {
    const { address: walletParam } = useParams<{ address: string }>()
    const [currentUser, setCurrentUser] = useState<string>('')

    useEffect(() => {
        const loadMe = async () => {
            try {
                const profile = await getMe()
                if (profile?.wallet_address) {
                    setCurrentUser(profile.wallet_address)
                }
            } catch {
                // Not logged in — public view
            }
        }
        loadMe()
    }, [])

    if (!walletParam) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Invalid portfolio address.</p>
            </div>
        )
    }

    const isOwnProfile = Boolean(
        currentUser && walletParam.toLowerCase() === currentUser.toLowerCase()
    )

    return (
        <EcoPortfolioPage
            wallet={walletParam}
            isOwnProfile={isOwnProfile}
        />
    )
}

/**
 * Route for viewing your own Eco Portfolio.
 * Accessible at /my-portfolio (redirects to your wallet's portfolio)
 */
export function MyPortfolioRoute() {
    const [wallet, setWallet] = useState<string>('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadMe = async () => {
            try {
                const profile = await getMe()
                if (profile?.wallet_address) {
                    setWallet(profile.wallet_address)
                }
            } catch (err) {
                console.error('Failed to load profile:', err)
            } finally {
                setLoading(false)
            }
        }
        loadMe()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="eco-portfolio-spinner" />
            </div>
        )
    }

    if (!wallet) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Please sign in to view your portfolio.</p>
            </div>
        )
    }

    return <EcoPortfolioPage wallet={wallet} isOwnProfile={true} />
}
