import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SignInRoute } from './routes/SignInRoute'
import { CreateProfileRoute } from './routes/CreateProfileRoute'
import { FeedRoute } from './routes/FeedRoute'
import { ProfileRoute } from './routes/ProfileRoute'
import { VisitProfileRoute } from './routes/VisitProfileRoute'
import { FriendsRoute } from './routes/FriendsRoute'
import { PostViewRoute } from './routes/PostViewRoute'
import { DashboardRoute } from './routes/DashboardRoute'
import { useAuthSync } from './hooks/useAuthSync'

function AppRoutes() {
    useAuthSync()

    return (
        <Routes>
            <Route path="/signin" element={<SignInRoute />} />

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
            <Route
                path="/friends"
                element={
                    <ProtectedRoute>
                        <FriendsRoute />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/post/:postCid"
                element={
                    <ProtectedRoute>
                        <PostViewRoute />
                    </ProtectedRoute>
                }
            />

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


