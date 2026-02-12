// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloProvider } from '@apollo/client'
import { graphClient } from './config/apollo'
import './App'
import './styles.css'
import App from './App'

//! The Graph integration - provides GraphQL client for reading blockchain data
createRoot(document.getElementById('root')!).render(
    <ApolloProvider client={graphClient}>
        <App />
    </ApolloProvider>
)