import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileCreate } from '../pages/ProfileCreate'
import { getMe } from '../api'

export function CreateProfileRoute() {
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

    const handleDone = () => {
        navigate('/feed')
    }

    return (
        <div className="max-w-xl mx-auto">
            <ProfileCreate address={address} onDone={handleDone} />
        </div>
    )
}
