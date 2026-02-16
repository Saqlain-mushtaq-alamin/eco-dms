import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dashboard } from '../pages/Dashboard'
import { getMe } from '../api'

export function DashboardRoute() {
    const navigate = useNavigate()
    const [address, setAddress] = useState<string>('')

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const profile = await getMe()
                if (profile?.wallet_address) {
                    setAddress(profile.wallet_address)
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

    if (!address) {
        return (
            <div className="flex items-center justify-center h-64">
                <p>Loading...</p>
            </div>
        )
    }

    return <Dashboard address={address} onBack={handleBack} />
}
