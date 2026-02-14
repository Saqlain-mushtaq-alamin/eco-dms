export interface MetaTransactionConfig {
    relayerUrl: string;
    apiKey?: string;
}

export interface RelayRequest {
    from: string;
    to: string;
    data: string;
    value?: string;
    gas?: string;
    chainId: number;
}

export interface RelayResponse {
    taskId: string;
    status: 'pending' | 'submitted' | 'confirmed' | 'failed';
    transactionHash?: string;
}

/**
 * Meta-Transaction Service for gasless transactions
 * Can be configured with Biconomy, Gelato, or custom relay
 */
export class MetaTransactionService {
    private config: MetaTransactionConfig;

    constructor(config: MetaTransactionConfig) {
        this.config = config;
    }

    /**
     * Send a meta-transaction through a relay
     */
    async sendTransaction(request: RelayRequest): Promise<RelayResponse> {
        try {
            const response = await fetch(`${this.config.relayerUrl}/relay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`Relay error: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error: any) {
            console.error('Meta-transaction error:', error);
            throw error;
        }
    }

    /**
     * Check the status of a relayed transaction
     */
    async getTransactionStatus(taskId: string): Promise<RelayResponse> {
        try {
            const response = await fetch(`${this.config.relayerUrl}/relay/${taskId}`, {
                method: 'GET',
                headers: {
                    ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
                },
            });

            if (!response.ok) {
                throw new Error(`Status check error: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error: any) {
            console.error('Status check error:', error);
            throw error;
        }
    }

    /**
     * Encode function call for meta-transaction
     */
    encodeFunction(
        contractInterface: any,
        functionName: string,
        params: any[]
    ): string {
        // This would use ethers.js Contract interface
        // Platform-specific implementation needed
        return contractInterface.encodeFunctionData(functionName, params);
    }

    /**
     * Batch multiple transactions into one relay request
     */
    async batchTransactions(requests: RelayRequest[]): Promise<RelayResponse[]> {
        const results = await Promise.all(
            requests.map(request => this.sendTransaction(request))
        );
        return results;
    }
}
