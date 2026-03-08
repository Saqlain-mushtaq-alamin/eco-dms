import React, { useState } from 'react'
import { Card, WalletConnectActionsPanel, WalletConnectHero } from '@eco-dms/ui'
import { getNonce, prepareMessage, verifySignature } from '../api'
import EthereumProvider from '@walletconnect/ethereum-provider'

export default function WalletConnect({ onConnected }: { onConnected: (address: string) => void }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [provider, setProvider] = useState<any>(null)

    const getTargetChainId = () => Number(import.meta.env.VITE_CHAIN_ID ?? 31337)

    const getProviderChainId = async (walletProvider: any) => {
        const rawChainId = await walletProvider.request({ method: 'eth_chainId' })
        return parseInt(String(rawChainId), 16)
    }

    const ensureConfiguredChain = async (walletProvider: any) => {
        const targetChainId = getTargetChainId()
        const targetHex = `0x${targetChainId.toString(16)}`
        const currentChainId = await getProviderChainId(walletProvider)

        if (currentChainId === targetChainId) return targetChainId

        try {
            await walletProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetHex }],
            })
        } catch (switchError: any) {
            const message = String(switchError?.message || '').toLowerCase()
            if (switchError?.code === 4902 || message.includes('unknown chain') || message.includes('unrecognized chain')) {
                await walletProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: targetHex,
                        chainName: 'Hardhat Local',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: [import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545'],
                        blockExplorerUrls: [],
                    }],
                })
                await walletProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetHex }],
                })
            } else {
                throw switchError
            }
        }

        return getProviderChainId(walletProvider)
    }

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
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
        if (!projectId) {
            throw new Error('WalletConnect project ID missing (set VITE_WALLETCONNECT_PROJECT_ID)')
        }

        const wcProvider = await EthereumProvider.init({
            projectId,
            chains: [getTargetChainId()],
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

            const chainId = await ensureConfiguredChain(walletProvider)
            console.log('Using chain ID:', chainId)

            // Prepare SIWE message
            const { message } = await prepareMessage(address, chainId, nonce)
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
        <div className="relative w-full h-[100dvh] max-h-[100dvh] flex items-center px-3 md:px-6 signin-vibe-bg overflow-hidden">
            <div className="vibe-blob vibe-blob-one" aria-hidden="true" />
            <div className="vibe-blob vibe-blob-two" aria-hidden="true" />

            <div className="w-full h-full max-h-full mx-auto px-2 md:px-4 relative z-10 overflow-hidden">
                <Card
                    padding="lg"
                    style={{ borderWidth: 0, borderColor: 'transparent', borderRadius: 24, shadowColor: '#010203', shadowOpacity: 0.08, shadowRadius: 22, elevation: 3, height: '100%' }}
                    variant="glass"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center h-full overflow-hidden gap-8 lg:gap-10">
                        <div className="hidden md:flex flex-1 flex-col justify-center">
                            <WalletConnectHero
                                title="Discover what truly excites you"
                                subtitle="Decentralized Social Impact Platform"
                            />
                        </div>

                        <div className="w-full lg:w-auto lg:min-w-[450px] lg:ml-auto">
                            <WalletConnectActionsPanel
                                title="Welcome to Eco DMS"
                                subtitle="Sign in with Ethereum to join the ecosystem working to save the planet."
                                error={error}
                                loading={loading}
                                onMetaMask={() => handleConnect('metamask')}
                                onWalletConnect={() => handleConnect('walletconnect')}
                            />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}