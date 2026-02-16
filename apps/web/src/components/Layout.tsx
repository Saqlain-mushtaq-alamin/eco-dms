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
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="text-2xl font-bold text-green-600 hover:text-green-700">
                            🌱 Eco DMS
                        </Link>

                        {isAuthenticated && (
                            <div className="flex gap-3">
                                <Link
                                    to="/feed"
                                    className="px-4 py-2 text-gray-700 hover:text-green-600 font-medium"
                                >
                                    Feed
                                </Link>
                                <Link
                                    to="/dashboard"
                                    className="px-4 py-2 text-gray-700 hover:text-green-600 font-medium"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to="/profile"
                                    className="px-4 py-2 text-gray-700 hover:text-green-600 font-medium"
                                >
                                    Profile
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
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
