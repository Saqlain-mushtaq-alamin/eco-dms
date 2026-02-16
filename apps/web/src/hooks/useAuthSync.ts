import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Syncs authentication state across all browser tabs
 * When user logs out in one tab, all other tabs are logged out too
 */
export function useAuthSync() {
    const navigate = useNavigate()

    useEffect(() => {
        // Listen for storage changes in other tabs
        const handleStorageChange = (e: StorageEvent) => {
            // If auth_token was removed, redirect to signin
            if (e.key === 'auth_token' && e.newValue === null) {
                console.log('Logout detected in another tab, redirecting to signin...')
                navigate('/signin', { replace: true })
            }

            // If auth_token was added, reload the page to update auth state
            if (e.key === 'auth_token' && e.oldValue === null && e.newValue !== null) {
                console.log('Login detected in another tab, reloading...')
                window.location.reload()
            }
        }

        window.addEventListener('storage', handleStorageChange)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
        }
    }, [navigate])
}
