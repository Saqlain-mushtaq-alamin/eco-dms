import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logout } from '../api'

export function Layout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate()
    const isAuthenticated = !!localStorage.getItem('auth_token')

    const handleLogout = async () => {
        await logout()
        navigate('/signin')
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
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            to="/"
                            className="text-2xl font-bold hover:opacity-80 transition-opacity"
                            style={{ color: '#abca2f' }}
                        >
                            🌱 Eco  DMS
                        </Link>

                        {isAuthenticated && (
                            <div className="flex gap-3">
                                <Link
                                    to="/feed"
                                    className="px-4 py-2 rounded-lg font-medium transition-all hover:bg-[rgba(171,202,47,0.1)]"
                                    style={{ color: '#abca2f' }}
                                >
                                    Feed
                                </Link>
                                <Link
                                    to="/dashboard"
                                    className="px-4 py-2 rounded-lg font-medium transition-all hover:bg-[rgba(171,202,47,0.1)]"
                                    style={{ color: '#abca2f' }}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to="/profile"
                                    className="px-4 py-2 rounded-lg font-medium transition-all hover:bg-[rgba(171,202,47,0.1)]"
                                    style={{ color: '#abca2f' }}
                                >
                                    Profile
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 rounded-lg font-medium transition-all"
                                    style={{
                                        backgroundColor: '#abca2f',
                                        color: '#010203'
                                    }}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {children}
            </main>
        </div>
    )
}
