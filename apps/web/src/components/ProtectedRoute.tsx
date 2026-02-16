import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMe } from '../api'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [hasProfile, setHasProfile] = useState(false)

    const checkAuth = async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            setIsAuthenticated(false)
            setLoading(false)
            return
        }

        try {
            const profile = await getMe()
            setIsAuthenticated(true)
            setHasProfile(!!(profile?.username && profile.username.trim()))
        } catch (err) {
            console.error('Auth check failed:', err)
            localStorage.removeItem('auth_token')
            setIsAuthenticated(false)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        checkAuth()

        // Periodic auth check every 30 seconds
        const interval = setInterval(() => {
            const token = localStorage.getItem('auth_token')
            if (!token && isAuthenticated) {
                console.log('Auth token removed, logging out...')
                setIsAuthenticated(false)
                navigate('/signin', { replace: true })
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [isAuthenticated, navigate])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />
    }

    // If authenticated but no profile, redirect to create profile
    if (!hasProfile && window.location.pathname !== '/profile/create') {
        return <Navigate to="/profile/create" replace />
    }

    return <>{children}</>
}
