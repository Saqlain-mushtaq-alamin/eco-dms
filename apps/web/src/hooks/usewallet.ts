// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\hooks\useWallet.ts
import { ethers } from 'ethers'

export function useMetaMask() {
  async function connect() {
    if (!(window as any).ethereum) throw new Error('No MetaMask')
    const provider = new ethers.BrowserProvider((window as any).ethereum)
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    const network = await provider.getNetwork()
    return { provider, signer, address, chainId: Number(network.chainId) }
  }
  return { connect }
}