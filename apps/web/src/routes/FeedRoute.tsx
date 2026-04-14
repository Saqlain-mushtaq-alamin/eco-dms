import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Feed } from '../pages/Feed'
import { getMe } from '../api'

export function FeedRoute() {
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

    const handleVisitProfile = (walletAddress: string) => {
        navigate(`/profile/${walletAddress}`)
    }

    const handleOpenPost = (postCid: string, imageIndex: number = 0) => {
        navigate(`/post/${postCid}?image=${imageIndex}`)
    }

    if (!address) {
        return (
            <div className="flex items-center justify-center h-64">
                <p>Loading...</p>
            </div>
        )
    }

    return <Feed address={address} onVisitProfile={handleVisitProfile} onOpenPost={handleOpenPost} />
}
