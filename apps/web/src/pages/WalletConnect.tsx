import React, { useState } from 'react'
import { Button, Card } from '@eco-dms/ui'
import { getNonce, prepareMessage, verifySignature } from '../api'
import EthereumProvider from '@walletconnect/ethereum-provider'

export default function WalletConnect({ onConnected }: { onConnected: (address: string) => void }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [provider, setProvider] = useState<any>(null)

    const connectMetaMask = async () => {
        if (!(window as any).ethereum) {
            throw new Error('MetaMask not installed')
        }
        const accounts = await (window as any).ethereum.request({
            method: 'eth_requestAccounts'
        })
        return { address: accounts[0], provider: (window as any).ethereum }
    }

    const connectWalletConnect = async () => {
        const wcProvider = await EthereumProvider.init({
            projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Replace with your project ID
            chains: [1], // Ethereum mainnet
            showQrModal: true,
        })

        await wcProvider.enable()
        const accounts = wcProvider.accounts
        setProvider(wcProvider)
        return { address: accounts[0], provider: wcProvider }
    }

    const handleConnect = async (method: 'metamask' | 'walletconnect') => {
        setLoading(true)
        setError('')

        try {
            // Connect wallet
            const { address, provider: walletProvider } = method === 'metamask'
                ? await connectMetaMask()
                : await connectWalletConnect()

            console.log('Connected:', address)

            // Get nonce from backend
            const { nonce } = await getNonce()
            console.log('Got nonce:', nonce)

            // Prepare SIWE message
            const { message } = await prepareMessage(address, 1, nonce)
            console.log('Got message to sign')

            // Sign message
            let signature: string
            if (method === 'metamask') {
                signature = await walletProvider.request({
                    method: 'personal_sign',
                    params: [message, address]
                })
            } else {
                signature = await walletProvider.request({
                    method: 'personal_sign',
                    params: [message, address]
                })
            }
            console.log('Got signature')

            // Verify signature on backend
            const result = await verifySignature(message, signature)
            console.log('Signature verified:', result)

            // Success - call callback
            onConnected(address)
        } catch (err: any) {
            console.error('Connect error:', err)
            setError(err.message || 'Connection failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card padding="lg" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: '600', marginBottom: 16 }}>Sign In with Ethereum</h2>
            {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Button
                    title={loading ? 'Connecting...' : 'Connect with MetaMask'}
                    onPress={() => handleConnect('metamask')}
                    variant="primary"
                    disabled={loading}
                />
                <Button
                    title={loading ? 'Connecting...' : 'Connect with WalletConnect'}
                    onPress={() => handleConnect('walletconnect')}
                    variant="secondary"
                    disabled={loading}
                />
            </div>
        </Card>
    )
}