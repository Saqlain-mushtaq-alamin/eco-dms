import { BrowserProvider, JsonRpcSigner } from 'ethers';

/**
 * Shared Wallet Service
 * Platform-specific implementations should extend this
 */
export class WalletService {
    private provider: BrowserProvider | null = null;
    private signer: JsonRpcSigner | null = null;

    async connect(): Promise<{ address: string; chainId: number }> {
        // This is a base implementation for web
        // Mobile apps should override with platform-specific wallet connectors
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            throw new Error('No wallet detected');
        }

        this.provider = new BrowserProvider((window as any).ethereum);
        await this.provider.send('eth_requestAccounts', []);
        this.signer = await this.provider.getSigner();

        const address = await this.signer.getAddress();
        const network = await this.provider.getNetwork();

        return {
            address,
            chainId: Number(network.chainId),
        };
    }

    async disconnect(): Promise<void> {
        this.provider = null;
        this.signer = null;
    }

    async signMessage(message: string): Promise<string> {
        if (!this.signer) {
            throw new Error('Wallet not connected');
        }
        return await this.signer.signMessage(message);
    }

    async switchChain(chainId: number): Promise<void> {
        if (!this.provider) {
            throw new Error('Wallet not connected');
        }

        const chainIdHex = `0x${chainId.toString(16)}`;

        try {
            await this.provider.send('wallet_switchEthereumChain', [{ chainId: chainIdHex }]);
        } catch (error: any) {
            // Chain not added, try adding it
            if (error.code === 4902) {
                throw new Error('Chain not configured in wallet');
            }
            throw error;
        }
    }

    getProvider(): BrowserProvider | null {
        return this.provider;
    }

    getSigner(): JsonRpcSigner | null {
        return this.signer;
    }
}
