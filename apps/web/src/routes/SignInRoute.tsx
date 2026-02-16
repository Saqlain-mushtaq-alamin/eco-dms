import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WalletConnect from '../pages/WalletConnect'
import { getMe } from '../api'

export function SignInRoute() {
    const navigate = useNavigate()

    const handleConnected = async (address: string) => {
        try {
            const profile = await getMe()
            if (profile?.username && profile.username.trim()) {
                navigate('/feed')
            } else {
                navigate('/profile/create')
            }
        } catch (err) {
            console.log('getMe after connect failed:', err)
            navigate('/profile/create')
        }
    }

    return (
        <div className="max-w-xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-center">Welcome to Eco DMS</h1>
            <p className="text-gray-600 text-center mb-8">
                Connect your wallet to verify eco-friendly content and earn rewards
            </p>
            <WalletConnect onConnected={handleConnected} />
        </div>
    )
}
