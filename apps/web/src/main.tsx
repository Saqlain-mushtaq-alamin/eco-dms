// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloProvider } from '@apollo/client'
import { graphClient } from './config/apollo'
import './App'
import './styles.css'
import App from './App'

//! Error Boundary Component
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                    <h1>⚠️ Application Error</h1>
                    <p>The app failed to start. This might be because:</p>
                    <ul>
                        <li><strong>Docker is not running</strong> - Start Docker Desktop</li>
                        <li><strong>The Graph is not running</strong> - Run: <code>make graph-start</code></li>
                    </ul>
                    <details>
                        <summary>Error Details</summary>
                        <pre>{this.state.error?.toString()}</pre>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
                    >
                        Retry
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

//! The Graph integration - provides GraphQL client for reading blockchain data
createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <ApolloProvider client={graphClient}>
            <App />
        </ApolloProvider>
    </ErrorBoundary>
)