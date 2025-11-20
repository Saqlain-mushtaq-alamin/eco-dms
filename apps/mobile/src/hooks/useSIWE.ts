import { getNonce, prepareMessage, verifySignature } from '../api'

export interface AuthResponse {
    address: string
    is_new: boolean
}

export function useSIWE() {
    // Replace with real wallet interaction; here we accept address + signer callback
    async function signWithExternalWallet(
        address: string,
        chainId: number,
        signatureProvider: (message: string) => Promise<string>
    ): Promise<AuthResponse> {
        const { nonce } = await getNonce()
        const prep = await prepareMessage(address, chainId, nonce)
        const signature = await signatureProvider(prep.message)
        const auth = await verifySignature(prep.message, signature)
        return auth as AuthResponse
    }
    return { signWithExternalWallet }
}