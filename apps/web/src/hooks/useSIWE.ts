// Removed bad import of shared siwe_message (unused) to fix TS2307
import { getNonce, prepareMessage, verifySignature } from '../api'
import { ethers } from 'ethers'

export interface AuthResponse {
  address: string
  is_new: boolean
}

export function useSIWE() {
  async function signInWithMetaMask(): Promise<AuthResponse> {
    if (!(window as any).ethereum) throw new Error('No MetaMask')
    const provider = new ethers.BrowserProvider((window as any).ethereum)
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    const network = await provider.getNetwork()
    const { nonce } = await getNonce()
    const prep = await prepareMessage(address, Number(network.chainId), nonce)
    const signature = await signer.signMessage(prep.message)
    const auth = await verifySignature(prep.message, signature)
    return auth as AuthResponse
  }
  return { signInWithMetaMask }
}