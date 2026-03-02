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
        <div className="w-full max-w-md">
            <Card
                padding="lg"
                style={{ borderWidth: 2, borderColor: '#abca2f', borderRadius: 24 }}
            >
                <div className="text-center mb-6">
                    <h2 className="text-4xl font-bold text-[#abca2f] mb-2">Let's goooo! 🚀</h2>
                    <p className="text-lg text-gray-700">Sign in with Ethereum</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border-2 border-red-400 rounded-xl text-red-700">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <Button
                        title={loading ? '⏳ Vibing...' : '🦊 Connect with MetaMask'}
                        onPress={() => handleConnect('metamask')}
                        variant="primary"
                        disabled={loading}
                    />
                    <Button
                        title={loading ? '⏳ Vibing...' : '🔗 Connect with WalletConnect'}
                        onPress={() => handleConnect('walletconnect')}
                        variant="secondary"
                        disabled={loading}
                    />
                </div>

          
            </Card>
        </div>
    )
}