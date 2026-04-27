import React, { useState } from 'react'
import { getNonce, prepareMessage, verifySignature } from '../api'
import EthereumProvider from '@walletconnect/ethereum-provider'

export default function WalletConnect({ onConnected }: { onConnected: (address: string) => void }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

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
        <div className="signin-cosmos">
            <div className="signin-cosmos__aurora" aria-hidden="true" />
            <div className="signin-cosmos__grid" aria-hidden="true" />
            <div className="signin-cosmos__rings" aria-hidden="true" />

            <div className="signin-shell">
                <section className="signin-side signin-side--left">
                    <div className="signin-glass signin-glass--left">
                        <div className="signin-left-orbit" aria-hidden="true">
                            <span className="signin-left-orbit__ring signin-left-orbit__ring--outer" />
                            <span className="signin-left-orbit__ring signin-left-orbit__ring--mid" />
                            <span className="signin-left-orbit__ring signin-left-orbit__ring--inner" />
                            <span className="signin-left-orbit__node signin-left-orbit__node--a" />
                            <span className="signin-left-orbit__node signin-left-orbit__node--b" />
                            <span className="signin-left-orbit__node signin-left-orbit__node--c" />
                        </div>
                        <div className="signin-left-lines" aria-hidden="true">
                            <span className="signin-left-lines__beam signin-left-lines__beam--one" />
                            <span className="signin-left-lines__beam signin-left-lines__beam--two" />
                            <span className="signin-left-lines__beam signin-left-lines__beam--three" />
                        </div>

                        <p className="signin-kicker">eco dms</p>
                        <h1 className="signin-title">eco dms</h1>
                        <p className="signin-tagline">Grow what you give.</p>
                        <p className="signin-support-copy">
                            Build trust, verify impact, and turn sustainability into shared action.
                        </p>
                    </div>
                </section>

                <section className="signin-side signin-side--right">
                    <div className="signin-glass signin-glass--right">
                        <h2 className="signin-ethos">
                            <span>Your actions.</span> <span>Your data.</span> <span>Your earth.</span>
                        </h2>
                        <p className="signin-subtitle">
                            <strong>Sign in with Ethereum</strong> to join the ecosystem working to save the planet.
                        </p>

                        {error ? <div className="signin-error">{error}</div> : null}

                        <div className="signin-actions">
                            <button
                                type="button"
                                className="signin-wallet-btn"
                                disabled={loading}
                                onClick={() => handleConnect('metamask')}
                            >
                                <span className="signin-wallet-btn__copy">
                                    <strong>Connect with MetaMask</strong>
                                    <small>Use your browser wallet</small>
                                </span>
                                {loading ? <span className="signin-loader" aria-hidden="true" /> : null}
                            </button>

                            <button
                                type="button"
                                className="signin-wallet-btn signin-wallet-btn--alt"
                                disabled={loading}
                                onClick={() => handleConnect('walletconnect')}
                            >
                                <span className="signin-wallet-btn__copy">
                                    <strong>Connect with WalletConnect</strong>
                                    <small>Scan QR with your mobile wallet</small>
                                </span>
                                {loading ? <span className="signin-loader" aria-hidden="true" /> : null}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}