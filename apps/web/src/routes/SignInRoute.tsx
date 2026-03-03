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
        <div className="w-full">
            <WalletConnect onConnected={handleConnected} />
        </div>
    )
}
