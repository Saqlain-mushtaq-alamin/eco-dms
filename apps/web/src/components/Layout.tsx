import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getMe, logout, searchUserAccounts } from '../api'

interface SearchUser {
    wallet_address: string
    username?: string
}

interface NavItem {
    to: string
    icon: string
    label: string
}

export function Layout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate()
    const location = useLocation()
    const isAuthenticated = !!localStorage.getItem('auth_token')
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchUser[]>([])
    const [searching, setSearching] = useState(false)
    const [showSearchDropdown, setShowSearchDropdown] = useState(false)
    const [showProfileDropdown, setShowProfileDropdown] = useState(false)
    const [profileName, setProfileName] = useState('My Profile')
    const searchRef = useRef<HTMLFormElement>(null)
    const profileRef = useRef<HTMLDivElement>(null)

    const navItems: NavItem[] = useMemo(() => ([
        { to: '/feed', icon: '🏠', label: 'Feed' },
        { to: '/dashboard', icon: '📊', label: 'Dashboard' },
        { to: '/friends', icon: '👥', label: 'Friends' }
    ]), [])

    useEffect(() => {
        if (!isAuthenticated) return

        const loadProfileName = async () => {
            try {
                const profile = await getMe()
                const username = (profile?.username || '').trim()
                const wallet = (profile?.wallet_address || '').trim()
                if (username) {
                    setProfileName(username)
                } else if (wallet) {
                    setProfileName(`${wallet.slice(0, 6)}...${wallet.slice(-4)}`)
                }
            } catch (error) {
                console.error('Failed to load profile name:', error)
            }
        }

        loadProfileName()
    }, [isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated) return

        const normalizedQuery = query.trim()
        if (normalizedQuery.length < 2) {
            setSearchResults([])
            return
        }

        const timeout = setTimeout(async () => {
            try {
                setSearching(true)
                const data = await searchUserAccounts(normalizedQuery, 8)
                setSearchResults(data?.users || [])
            } catch (error) {
                console.error('Search failed:', error)
                setSearchResults([])
            } finally {
                setSearching(false)
            }
        }, 250)

        return () => clearTimeout(timeout)
    }, [query, isAuthenticated])

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            const targetNode = event.target as Node

            if (searchRef.current && !searchRef.current.contains(targetNode)) {
                setShowSearchDropdown(false)
            }

            if (profileRef.current && !profileRef.current.contains(targetNode)) {
                setShowProfileDropdown(false)
            }
        }

        document.addEventListener('mousedown', onDocumentClick)
        return () => document.removeEventListener('mousedown', onDocumentClick)
    }, [])

    const handleLogout = async () => {
        await logout()
        setShowProfileDropdown(false)
        navigate('/signin')
    }

    const handleSearchSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const normalizedQuery = query.trim()
        if (!normalizedQuery) return
        setShowSearchDropdown(false)
        navigate(`/friends?q=${encodeURIComponent(normalizedQuery)}`)
    }

    const handleSearchResultClick = (walletAddress: string) => {
        setShowSearchDropdown(false)
        navigate(`/profile/${walletAddress}`)
    }

    return (
        <div className="min-h-screen" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f1f1 100%)',
            minHeight: '100vh'
        }}>
            <nav className="glass" style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}>
                <div className="w-full px-6 py-3">
                    <div className="grid grid-cols-3 items-center gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <Link
                                to="/"
                                className="text-2xl font-bold hover:opacity-80 transition-opacity whitespace-nowrap"
                                style={{ color: '#abca2f' }}
                            >
                                🌱 Eco DMS
                            </Link>

                            {isAuthenticated && (
                                <form onSubmit={handleSearchSubmit} className="relative w-full" ref={searchRef}>
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        onFocus={() => setShowSearchDropdown(true)}
                                        placeholder="Search accounts..."
                                        className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                                    />

                                    {showSearchDropdown && query.trim().length >= 2 && (
                                        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
                                            {searching ? (
                                                <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-gray-500">No account found</div>
                                            ) : (
                                                searchResults.map((user) => (
                                                    <button
                                                        key={user.wallet_address}
                                                        type="button"
                                                        onClick={() => handleSearchResultClick(user.wallet_address)}
                                                        className="w-full px-4 py-3 text-left hover:bg-gray-50"
                                                    >
                                                        <div className="text-sm font-medium text-gray-900">{user.username || 'Unnamed user'}</div>
                                                        <div className="text-xs text-gray-500 break-all">{user.wallet_address}</div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </form>
                            )}
                        </div>

                        {isAuthenticated && (
                            <div className="flex items-center justify-center gap-3">
                                {navItems.map((item) => {
                                    const isActive = location.pathname.startsWith(item.to)
                                    return (
                                        <Link
                                            key={item.to}
                                            to={item.to}
                                            className="h-11 w-11 rounded-full flex items-center justify-center text-xl transition-all"
                                            style={{
                                                backgroundColor: isActive ? '#abca2f' : 'rgba(171,202,47,0.12)',
                                                color: isActive ? '#010203' : '#5b6d14'
                                            }}
                                            title={item.label}
                                        >
                                            <span>{item.icon}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}

                        {isAuthenticated && (
                            <div className="flex items-center justify-end gap-3" ref={profileRef}>
                                <button
                                    type="button"
                                    className="h-11 w-11 rounded-full flex items-center justify-center text-lg"
                                    style={{ backgroundColor: 'rgba(171,202,47,0.12)', color: '#5b6d14' }}
                                    title="Notifications"
                                >
                                    🔔
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowProfileDropdown((prev) => !prev)}
                                    className="h-11 w-11 rounded-full flex items-center justify-center text-lg"
                                    style={{ backgroundColor: '#abca2f', color: '#010203' }}
                                    title="Profile menu"
                                >
                                    👤
                                </button>

                                {showProfileDropdown && (
                                    <div className="absolute top-[72px] right-6 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2">
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <p className="text-sm text-gray-500">Signed in as</p>
                                            <p className="font-semibold text-gray-900 truncate">{profileName}</p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowProfileDropdown(false)
                                                navigate('/profile')
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                                        >
                                            <span>Profile</span><span>👤</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                                        >
                                            <span>Settings</span><span>⚙️</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                                        >
                                            <span>Privacy</span><span>🔒</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                                        >
                                            <span>Help & Support</span><span>❓</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between text-red-600"
                                        >
                                            <span>Logout</span><span>↩️</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="w-full px-6 py-8">
                {children}
            </main>
        </div>
    )
}
