
// Helper to build client-side message (must match backend format)
export function buildSiweMessage(address: string, chainId: number, nonce: string) {
  return `${address.toLowerCase()} wants to sign in to localhost.

URI: http://localhost:8000
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}`;
}