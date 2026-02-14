export interface SIWEConfig {
    domain: string;
    uri: string;
    chainId: number;
    version?: string;
    nonce?: string;
}

export interface SIWEMessage {
    domain: string;
    address: string;
    statement?: string;
    uri: string;
    version: string;
    chainId: number;
    nonce: string;
    issuedAt: string;
    expirationTime?: string;
    notBefore?: string;
    requestId?: string;
    resources?: string[];
}

/**
 * Sign-In with Ethereum (SIWE) Service
 * Implements EIP-4361 for wallet-based authentication
 */
export class SIWEService {
    private config: SIWEConfig;

    constructor(config: SIWEConfig) {
        this.config = {
            version: '1',
            ...config,
        };
    }

    /**
     * Generate a random nonce for SIWE message
     */
    generateNonce(): string {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    /**
     * Create a SIWE message object
     */
    createMessage(address: string, statement?: string): SIWEMessage {
        const nonce = this.config.nonce || this.generateNonce();
        const issuedAt = new Date().toISOString();

        // Set expiration to 24 hours from now
        const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        return {
            domain: this.config.domain,
            address,
            statement: statement || 'Sign in to Eco-DMS',
            uri: this.config.uri,
            version: this.config.version || '1',
            chainId: this.config.chainId,
            nonce,
            issuedAt,
            expirationTime,
        };
    }

    /**
     * Format SIWE message as per EIP-4361 specification
     */
    formatMessage(message: SIWEMessage): string {
        const header = `${message.domain} wants you to sign in with your Ethereum account:`;
        const addressLine = message.address;
        const statementLine = message.statement ? `\n${message.statement}` : '';

        const fields = [
            '',
            `URI: ${message.uri}`,
            `Version: ${message.version}`,
            `Chain ID: ${message.chainId}`,
            `Nonce: ${message.nonce}`,
            `Issued At: ${message.issuedAt}`,
        ];

        if (message.expirationTime) {
            fields.push(`Expiration Time: ${message.expirationTime}`);
        }
        if (message.notBefore) {
            fields.push(`Not Before: ${message.notBefore}`);
        }
        if (message.requestId) {
            fields.push(`Request ID: ${message.requestId}`);
        }
        if (message.resources && message.resources.length > 0) {
            fields.push(`Resources:`);
            message.resources.forEach(resource => {
                fields.push(`- ${resource}`);
            });
        }

        return `${header}\n${addressLine}${statementLine}\n${fields.join('\n')}`;
    }

    /**
     * Verify a SIWE message signature (should be done server-side)
     */
    async verifyMessage(
        message: SIWEMessage,
        signature: string,
        apiUrl: string
    ): Promise<boolean> {
        try {
            const response = await fetch(`${apiUrl}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, signature }),
            });

            const result = await response.json();
            return result.valid === true;
        } catch (error) {
            console.error('SIWE verification error:', error);
            return false;
        }
    }
}
