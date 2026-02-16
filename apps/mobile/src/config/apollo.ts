import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

/**
 * THE GRAPH APOLLO CLIENT FOR MOBILE
 * 
 * This client queries The Graph for READ operations:
 * - User profiles & stats
 * - Post feeds (eco-verified, timeline)
 * - Verifications & rewards
 * - Leaderboards
 */

// For mobile, use your computer's local IP or deployed Graph endpoint
const GRAPH_URL = 'http://127.0.0.1:8100/subgraphs/name/eco-dms';

export const graphClient = new ApolloClient({
    link: new HttpLink({
        uri: GRAPH_URL,
    }),
    cache: new InMemoryCache({
        typePolicies: {
            Query: {
                fields: {
                    posts: {
                        keyArgs: ['where', 'orderBy', 'orderDirection'],
                        merge(existing = [], incoming) {
                            return [...existing, ...incoming];
                        },
                    },
                    users: {
                        keyArgs: ['where', 'orderBy', 'orderDirection'],
                        merge(existing = [], incoming) {
                            return [...existing, ...incoming];
                        },
                    },
                },
            },
        },
    }),
    defaultOptions: {
        watchQuery: {
            fetchPolicy: 'cache-and-network',
            errorPolicy: 'all',
        },
        query: {
            fetchPolicy: 'network-only',
            errorPolicy: 'all',
        },
    },
});

/**
 * IPFS Gateway configuration
 */
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

/**
 * Fetch content from IPFS
 */
export async function fetchFromIPFS(cid: string): Promise<any> {
    try {
        const response = await fetch(`${IPFS_GATEWAY}${cid}`);
        if (!response.ok) {
            throw new Error(`IPFS fetch failed: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('IPFS fetch error:', error);
        throw error;
    }
}
