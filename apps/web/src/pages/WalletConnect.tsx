import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getNonce, prepareMessage, verifySignature, getMe } from '../api'
import EthereumProvider from '@walletconnect/ethereum-provider'

const API_BASE = 'http://localhost:8000'

interface SocialStatus {
    google: boolean
    github: boolean
    twitter: boolean
}

export default function WalletConnect({ onConnected }: { onConnected: (address: string) => void }) {
    const [loading, setLoading] = useState(false)
    const [socialLoading, setSocialLoading] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [socialStatus, setSocialStatus] = useState<SocialStatus>({ google: false, github: false, twitter: false })
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    // ── Check which social providers are configured ─────────────────────────
    useEffect(() => {
        fetch(`${API_BASE}/api/auth/social/status`)
            .then(r => r.json())
            .then(setSocialStatus)
            .catch(() => { /* backend may not be running yet */ })
    }, [])

    // ── Handle OAuth callback token (after social redirect back) ────────────
    useEffect(() => {
        const socialToken = searchParams.get('social_token')
        const socialProvider = searchParams.get('social_provider')
        const socialUsername = searchParams.get('social_username')
        const socialError = searchParams.get('social_error')

        if (socialError) {
            setError(`Social sign-in failed: ${socialError.replace(/_/g, ' ')}`)
            return
        }

        if (socialToken) {
            // Store JWT from OAuth provider
            localStorage.setItem('auth_token', socialToken)
            if (socialProvider) localStorage.setItem('social_provider', socialProvider)
            if (socialUsername) localStorage.setItem('social_username', socialUsername)

            // Clean URL params then redirect
            const url = new URL(window.location.href)
            url.searchParams.delete('social_token')
            url.searchParams.delete('social_provider')
            url.searchParams.delete('social_username')
            window.history.replaceState({}, '', url.toString())

            // Check profile then redirect
            getMe()
                .then(profile => {
                    if (profile?.username?.trim()) {
                        navigate('/feed')
                    } else {
                        navigate('/profile/create')
                    }
                })
                .catch(() => navigate('/profile/create'))
        }
    }, [searchParams, navigate])

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
            throw new Error('MetaMask not installed. Please install the MetaMask browser extension.')
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
            const { address, provider: walletProvider } = method === 'metamask'
                ? await connectMetaMask()
                : await connectWalletConnect()

            console.log('Connected:', address)

            const { nonce } = await getNonce()
            const chainId = await ensureConfiguredChain(walletProvider)
            const { message } = await prepareMessage(address, chainId, nonce)

            const signature = await walletProvider.request({
                method: 'personal_sign',
                params: [message, address]
            })

            const result = await verifySignature(message, signature)
            console.log('Signature verified:', result)

            onConnected(address)
        } catch (err: any) {
            console.error('Connect error:', err)
            setError(err.message || 'Connection failed')
        } finally {
            setLoading(false)
        }
    }

    const handleSocialLogin = (provider: 'google' | 'github' | 'twitter') => {
        if (!socialStatus[provider]) {
            setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not configured yet. Please contact the admin.`)
            return
        }
        setSocialLoading(provider)
        window.location.href = `${API_BASE}/api/auth/social/${provider}`
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

                        <p className="signin-kicker brand-sproudtly">
                            sprou<span className="brand-d">d</span>tly
                        </p>
                        <h1 className="signin-title brand-sproudtly">
                            sprou<span className="brand-d">d</span>tly
                        </h1>
                        <p className="signin-tagline">Grow what you give.</p>
                        <p className="signin-support-copy">
                            Plant eco-actions into the world, root connections, and watch your garden grow.
                        </p>
                    </div>
                </section>

                <section className="signin-side signin-side--right">
                    <div className="signin-glass signin-glass--right">
                        <h2 className="signin-ethos">
                            <span>Your actions.</span> <span>Your data.</span> <span>Your earth.</span>
                        </h2>
                        <p className="signin-subtitle">
                            <strong>Sign in with your wallet</strong> or social account to join the ecosystem.
                        </p>

                        {error ? <div className="signin-error" role="alert">{error}</div> : null}

                        {/* ── Web3 wallet buttons ── */}
                        <div className="signin-section-label">🔐 Web3 Wallet</div>
                        <div className="signin-actions">
                            <button
                                id="signin-metamask-btn"
                                type="button"
                                className="signin-wallet-btn"
                                disabled={loading}
                                onClick={() => handleConnect('metamask')}
                            >
                                <span className="signin-wallet-btn__icon">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                        <path d="M21.315 2L13.01 8.18l1.52-3.58L21.315 2z" fill="#E17726" />
                                        <path d="M2.685 2l8.24 6.24-1.44-3.64L2.685 2z" fill="#E27625" />
                                        <path d="M18.315 16.56l-2.2 3.38 4.72 1.3 1.36-4.62-3.88-.06z" fill="#E27625" />
                                        <path d="M2.225 16.62l1.34 4.62 4.72-1.3-2.2-3.38-3.86.06z" fill="#E27625" />
                                        <path d="M8.015 10.48l-1.3 1.96 4.64.2-.16-4.96-3.18 2.8z" fill="#E27625" />
                                        <path d="M15.985 10.48l-3.22-2.86-.1 5 4.62-.2-1.3-1.94z" fill="#E27625" />
                                        <path d="M8.285 19.94l2.8-1.34-2.42-1.88-.38 3.22z" fill="#E27625" />
                                        <path d="M12.915 18.6l2.8 1.34-.38-3.22-2.42 1.88z" fill="#E27625" />
                                    </svg>
                                </span>
                                <span className="signin-wallet-btn__copy">
                                    <strong>Connect with MetaMask</strong>
                                    <small>Use your browser wallet · passwordless</small>
                                </span>
                                {loading ? <span className="signin-loader" aria-hidden="true" /> : null}
                            </button>

                            <button
                                id="signin-walletconnect-btn"
                                type="button"
                                className="signin-wallet-btn signin-wallet-btn--alt"
                                disabled={loading}
                                onClick={() => handleConnect('walletconnect')}
                            >
                                <span className="signin-wallet-btn__icon">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M4.91 7.37C8.84 3.44 15.16 3.44 19.09 7.37l.49.49a.5.5 0 0 1 0 .71l-1.68 1.68a.25.25 0 0 1-.35 0l-.68-.68c-2.72-2.72-7.13-2.72-9.85 0l-.73.73a.25.25 0 0 1-.35 0L4.27 8.62a.5.5 0 0 1 0-.71l.64-.54zm9.72 3.88l1.49 1.49a.5.5 0 0 1 0 .71l-6.71 6.71a.5.5 0 0 1-.71 0l-4.76-4.76a.25.25 0 0 1 0-.35l1.68-1.68a.25.25 0 0 1 .35 0l3.4 3.4 5.54-5.54a.25.25 0 0 1 .35 0l-.63.02z" />
                                    </svg>
                                </span>
                                <span className="signin-wallet-btn__copy">
                                    <strong>Connect with WalletConnect</strong>
                                    <small>Scan QR with your mobile wallet</small>
                                </span>
                                {loading ? <span className="signin-loader" aria-hidden="true" /> : null}
                            </button>
                        </div>

                        {/* ── Divider ── */}
                        <div className="signin-divider" aria-hidden="true">
                            <span className="signin-divider__line" />
                            <span className="signin-divider__text">or continue with</span>
                            <span className="signin-divider__line" />
                        </div>

                        {/* ── Social sign-in buttons ── */}
                        <div className="signin-section-label">🌐 Social Account</div>
                        <div className="signin-social-row">
                            {/* Google */}
                            <button
                                id="signin-google-btn"
                                type="button"
                                className={`signin-social-btn signin-social-btn--google ${!socialStatus.google ? 'signin-social-btn--disabled' : ''}`}
                                onClick={() => handleSocialLogin('google')}
                                disabled={socialLoading !== null}
                                title={socialStatus.google ? 'Sign in with Google' : 'Google sign-in not configured'}
                            >
                                {socialLoading === 'google' ? (
                                    <span className="signin-loader signin-loader--sm" aria-hidden="true" />
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                )}
                                <span>Google</span>
                                {!socialStatus.google && <span className="signin-social-badge">Setup required</span>}
                            </button>

                            {/* GitHub */}
                            <button
                                id="signin-github-btn"
                                type="button"
                                className={`signin-social-btn signin-social-btn--github ${!socialStatus.github ? 'signin-social-btn--disabled' : ''}`}
                                onClick={() => handleSocialLogin('github')}
                                disabled={socialLoading !== null}
                                title={socialStatus.github ? 'Sign in with GitHub' : 'GitHub sign-in not configured'}
                            >
                                {socialLoading === 'github' ? (
                                    <span className="signin-loader signin-loader--sm" aria-hidden="true" />
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                                    </svg>
                                )}
                                <span>GitHub</span>
                                {!socialStatus.github && <span className="signin-social-badge">Setup required</span>}
                            </button>

                            {/* Twitter / X */}
                            <button
                                id="signin-twitter-btn"
                                type="button"
                                className={`signin-social-btn signin-social-btn--twitter ${!socialStatus.twitter ? 'signin-social-btn--disabled' : ''}`}
                                onClick={() => handleSocialLogin('twitter')}
                                disabled={socialLoading !== null}
                                title={socialStatus.twitter ? 'Sign in with Twitter / X' : 'Twitter sign-in not configured'}
                            >
                                {socialLoading === 'twitter' ? (
                                    <span className="signin-loader signin-loader--sm" aria-hidden="true" />
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                )}
                                <span>Twitter / X</span>
                                {!socialStatus.twitter && <span className="signin-social-badge">Setup required</span>}
                            </button>
                        </div>

                        <p className="signin-social-note">
                            💡 Social sign-in links your account without needing a crypto wallet.
                            Some features (token rewards, voting) require a wallet connection later.
                        </p>
                    </div>
                </section>
            </div>

            <footer className="signin-footer" aria-label="Sign in page footer">
                <div className="signin-footer__content">
                    <p className="signin-footer__brand brand-sproudtly text-lg">
                        Sprou<span className="brand-d">d</span>tly
                    </p>
                    <p className="signin-footer__meta">Secure SIWE + OAuth access for a decentralized garden impact ecosystem.</p>
                </div>

                <nav className="signin-footer__links" aria-label="Sign in resources">
                    <a href="https://github.com/Saqlain-mushtaq-alamin/eco-dms" target="_blank" rel="noreferrer">GitHub</a>
                    <a href="https://ethereum.org/en/developers/docs/standards/tokens/erc-4361/" target="_blank" rel="noreferrer">SIWE</a>
                    <a href="https://walletconnect.com/" target="_blank" rel="noreferrer">WalletConnect</a>
                    <a href="mailto:support@eco-dms.org">Support</a>
                </nav>

                <div className="signin-footer__status" role="status" aria-live="polite">
                    <span className="signin-footer__dot" aria-hidden="true" />
                    <span>Auth network ready</span>
                </div>
            </footer>
        </div>
    )
}