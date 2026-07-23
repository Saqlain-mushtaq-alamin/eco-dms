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
import { EcoPortfolioRoute, MyPortfolioRoute } from './routes/EcoPortfolioRoute'
import { DAORoute } from './routes/DAORoute'
import PublicPortfolio from './pages/PublicPortfolio'
import AdminFraudDashboard from './pages/AdminFraudDashboard'
import CredentialsPage from './pages/Credentials'
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

            <Route
                path="/my-portfolio"
                element={
                    <ProtectedRoute>
                        <MyPortfolioRoute />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/portfolio/:address"
                element={
                    <ProtectedRoute>
                        <EcoPortfolioRoute />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/dao"
                element={
                    <ProtectedRoute>
                        <DAORoute />
                    </ProtectedRoute>
                }
            />

            {/* Public portfolio — shareable, no auth required */}
            <Route path="/p/:address" element={<PublicPortfolio />} />

            <Route
                path="/credentials"
                element={
                    <ProtectedRoute>
                        <CredentialsPage />
                    </ProtectedRoute>
                }
            />

            {/* Admin — requires admin wallet, no nav layout */}
            <Route
                path="/admin/fraud"
                element={
                    <ProtectedRoute>
                        <AdminFraudDashboard />
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


