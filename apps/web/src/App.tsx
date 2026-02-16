// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\App.tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SignInRoute } from './routes/SignInRoute'
import { CreateProfileRoute } from './routes/CreateProfileRoute'
import { FeedRoute } from './routes/FeedRoute'
import { ProfileRoute } from './routes/ProfileRoute'
import { VisitProfileRoute } from './routes/VisitProfileRoute'
import { DashboardRoute } from './routes/DashboardRoute'
import { useAuthSync } from './hooks/useAuthSync'

function AppRoutes() {
    // Sync auth state across all tabs
    useAuthSync()

    return (
        <Routes>
            {/* Public route */}
            <Route path="/signin" element={<SignInRoute />} />

            {/* Protected routes */}
            <Route
                path="/profile/create"
                element={
                    <ProtectedRoute>
                        <CreateProfileRoute />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/feed"
                element={
                    <ProtectedRoute>
                        <FeedRoute />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <ProfileRoute />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile/:address"
                element={
                    <ProtectedRoute>
                        <VisitProfileRoute />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardRoute />
                    </ProtectedRoute>
                }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/feed" replace />} />
            <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <Layout>
                <AppRoutes />
            </Layout>
        </BrowserRouter>
    )
}


