/**
 * WalletConnect Configuration
 * 
 * To get your own Project ID:
 * 1. Go to https://cloud.walletconnect.com/
 * 2. Create a free account
 * 3. Create a new project
 * 4. Copy your Project ID and paste it below
 * 
 * Note: The demo Project ID below won't work. You MUST get your own.
 */

// Replace this with your own WalletConnect Project ID
export const WALLETCONNECT_PROJECT_ID = '294df0b46b618142c74b235b57ba8b07';

// Supported chains (Ethereum mainnet and testnets)
export const SUPPORTED_CHAINS = ['eip155:1', 'eip155:11155111', 'eip155:80001'];

// Session config
export const SESSION_CONFIG = {
    sessionProperties: {
        app: 'Eco-DMS Mobile',
    },
};
