import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VisitProfile from '../pages/VisitProfile'
import { getMe } from '../api'

export function VisitProfileRoute() {
    const { address: visitingAddress } = useParams<{ address: string }>()
    const navigate = useNavigate()
    const [currentUserAddress, setCurrentUserAddress] = useState<string>('')

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const profile = await getMe()
                if (profile?.wallet_address) {
                    setCurrentUserAddress(profile.wallet_address)
                }
            } catch (err) {
                console.error('Failed to load profile:', err)
            }
        }
        loadProfile()
    }, [])

    const handleBack = () => {
        navigate('/feed')
    }

    if (!currentUserAddress || !visitingAddress) {
        return (
            <div className="flex items-center justify-center h-64">
                <p>Loading...</p>
            </div>
        )
    }

    return (
        <VisitProfile
            walletAddress={visitingAddress}
            currentUserAddress={currentUserAddress}
            onBack={handleBack}
        />
    )
}
