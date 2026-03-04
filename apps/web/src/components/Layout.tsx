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

type ThemeMode = 'light' | 'dark'

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
    const [profileAvatarUri, setProfileAvatarUri] = useState('')
    const [themeMode, setThemeMode] = useState<ThemeMode>('light')
    const searchRef = useRef<HTMLFormElement>(null)
    const profileRef = useRef<HTMLDivElement>(null)

    const resolveIpfsUrl = (value?: string): string => {
        if (!value) return ''
        if (value.startsWith('http://') || value.startsWith('https://')) return value
        if (value.startsWith('ipfs://')) {
            return `https://ipfs.io/ipfs/${value.replace('ipfs://', '')}`
        }
        const clean = value.replace('ipfs/', '').replace('/ipfs/', '')
        return `https://ipfs.io/ipfs/${clean}`
    }

    const navItems: NavItem[] = useMemo(() => ([
        { to: '/feed', icon: '🏠', label: 'Feed' },
        { to: '/dashboard', icon: '📊', label: 'Dashboard' },
        { to: '/friends', icon: '👥', label: 'Friends' }

    ]), [])

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme_mode') as ThemeMode | null
        if (storedTheme === 'dark' || storedTheme === 'light') {
            setThemeMode(storedTheme)
            return
        }

        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        setThemeMode(prefersDark ? 'dark' : 'light')
    }, [])

    useEffect(() => {
        const root = document.documentElement
        root.classList.toggle('theme-dark', themeMode === 'dark')
        root.classList.toggle('theme-light', themeMode === 'light')
        localStorage.setItem('theme_mode', themeMode)
    }, [themeMode])

    useEffect(() => {
        if (!isAuthenticated) return

        const loadProfileName = async () => {
            try {
                const profile = await getMe()
                const username = (profile?.username || '').trim()
                const wallet = (profile?.wallet_address || '').trim()
                const avatar = resolveIpfsUrl(profile?.avatar_cid)
                if (username) {
                    setProfileName(username)
                } else if (wallet) {
                    setProfileName(`${wallet.slice(0, 6)}...${wallet.slice(-4)}`)
                }
                if (avatar) {
                    setProfileAvatarUri(avatar)
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

    const handleThemeToggle = () => {
        setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))
    }

    const isDarkMode = themeMode === 'dark'

    return (
        <div className="min-h-screen" style={{
            background: isDarkMode
                ? 'linear-gradient(135deg, #0f172a 0%, #111827 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f1f1f1 100%)',
            minHeight: '100vh'
        }}>
            <nav className="glass" style={{
                borderBottom: isDarkMode ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(255, 255, 255, 0.18)',
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
                                <form onSubmit={handleSearchSubmit} className="relative w-48" ref={searchRef}>
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        onFocus={() => setShowSearchDropdown(true)}
                                        placeholder=" 🔍 Search accounts..."
                                        className={`w-full rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 ${isDarkMode
                                            ? 'border-slate-600 bg-slate-900/70 text-slate-100 placeholder:text-slate-400'
                                            : 'border-gray-200 bg-white text-gray-900'
                                            }`}
                                    />

                                    {showSearchDropdown && query.trim().length >= 2 && (
                                        <div className={`absolute left-0 right-0 mt-2 border rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto ${isDarkMode
                                            ? 'bg-slate-900 border-slate-700'
                                            : 'bg-white border-gray-200'
                                            }`}>
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
                                                        className={`w-full px-4 py-3 text-left ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'}`}
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
                            <div className="flex items-center justify-center gap-5">
                                {navItems.map((item) => {
                                    const isActive = location.pathname.startsWith(item.to)
                                    return (
                                        <Link
                                            key={item.to}
                                            to={item.to}
                                            className="relative h-11 w-24 rounded-xl flex items-center justify-center text-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                            style={{
                                                backgroundColor: isActive ? '#abca2f' : 'rgba(171,202,47,0.12)',
                                                color: isActive ? '#010203' : isDarkMode ? '#d3f26a' : '#5b6d14'
                                            }}
                                            title={item.label}
                                        >
                                            <span>{item.icon}</span>
                                            <span
                                                className="absolute -bottom-4 left-1/2 h-1 w-full -translate-x-1/2 rounded-full transition-all duration-200"
                                                style={{
                                                    backgroundColor: '#abca2f',
                                                    opacity: isActive ? 1 : 0
                                                }}
                                            />
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
                                    style={{
                                        backgroundColor: isDarkMode ? 'rgba(163, 230, 53, 0.18)' : 'rgba(171,202,47,0.12)',
                                        color: isDarkMode ? '#d3f26a' : '#5b6d14'
                                    }}
                                    title="Notifications"
                                >
                                    🔔
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowProfileDropdown((prev) => !prev)}
                                    className="h-11 w-11 rounded-full flex items-center justify-center text-lg overflow-hidden"
                                    style={{ backgroundColor: '#abca2f', color: '#010203' }}
                                    title="Profile menu"
                                >
                                    {profileAvatarUri ? (
                                        <img src={profileAvatarUri} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="font-semibold">{profileName.charAt(0).toUpperCase() || 'U'}</span>
                                    )}
                                </button>

                                {showProfileDropdown && (
                                    <div className={`absolute top-[72px] right-6 w-72 border rounded-2xl shadow-xl z-50 p-3 mt-2 ${isDarkMode
                                        ? 'bg-slate-900 border-slate-700'
                                        : 'bg-white border-gray-200'
                                        }`}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowProfileDropdown(false)
                                                navigate('/profile')
                                            }}
                                            className="w-full text-left px-3 py-3 mb-2 rounded-xl border border-gray-100 hover:bg-lime-50 hover:text-gray-900 transition-colors flex items-center gap-3"
                                        >
                                            <span className="h-9 w-9 rounded-full bg-lime-100 text-lime-700 flex items-center justify-center text-base overflow-hidden">
                                                {profileAvatarUri ? (
                                                    <img src={profileAvatarUri} alt="Profile" className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="font-semibold">{profileName.charAt(0).toUpperCase() || 'U'}</span>
                                                )}
                                            </span>
                                            <span className="min-w-0">
                                                <p className="text-sm text-gray-500">Signed in as</p>
                                                <p className="font-semibold text-gray-900 truncate">{profileName}</p>
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 justify-start ${isDarkMode
                                                ? 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                                                : 'hover:bg-gray-50 hover:text-gray-900 text-gray-700'
                                                }`}
                                        >
                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>⚙️</span>
                                            <span>Settings</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 justify-start ${isDarkMode
                                                ? 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                                                : 'hover:bg-gray-50 hover:text-gray-900 text-gray-700'
                                                }`}
                                        >
                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>🔒</span>
                                            <span>Privacy</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 justify-start ${isDarkMode
                                                ? 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                                                : 'hover:bg-gray-50 hover:text-gray-900 text-gray-700'
                                                }`}
                                        >
                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>❓</span>
                                            <span>Help & Support</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleThemeToggle}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 justify-start ${isDarkMode
                                                ? 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                                                : 'hover:bg-gray-50 hover:text-gray-900 text-gray-700'
                                                }`}
                                        >
                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>🌓</span>
                                            <span>{isDarkMode ? 'Display & Accessibility (Switch to Light)' : 'Display & Accessibility (Switch to Dark)'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-50 hover:text-red-700 text-red-600 flex items-center gap-3 justify-start"
                                        >
                                            <span className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">↩️</span>
                                            <span>Logout</span>
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
