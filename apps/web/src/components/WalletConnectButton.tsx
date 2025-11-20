// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\components\WalletConnectButton.tsx
import React, { useState } from 'react'
import EthereumProvider from '@walletconnect/ethereum-provider'
import { getNonce, prepareMessage, verifySignature } from '../api'
import type { AuthResponse } from '../hooks/useSIWE'

export function WalletConnectButton({ onAuth }: { onAuth: (auth: AuthResponse) => void }) {
    const [loading, setLoading] = useState(false)

    async function connect() {
        setLoading(true)
        try {
            const provider = await EthereumProvider.init({
                projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
                chains: [1],              // EIP-155 chain IDs
                showQrModal: true
            })

            await provider.connect()

            // Get accounts and chain id via RPC (typed safely)
            const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
            const address = accounts[0]
            const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string
            const chainId = parseInt(chainIdHex, 16)

            const { nonce } = await getNonce()
            const prep = await prepareMessage(address, chainId, nonce)

            const signature = await provider.request({
                method: 'personal_sign',
                params: [prep.message, address]
            }) as string

            const auth = await verifySignature(prep.message, signature)
            onAuth(auth as AuthResponse)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return <button disabled={loading} onClick={connect}>WalletConnect Sign-In</button>
}
