import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

/**
 * THE GRAPH APOLLO CLIENT
 * 
 * This client queries The Graph for READ operations:
 * - User profiles & stats
 * - Post feeds (eco-verified, timeline)
 * - Verifications & rewards
 * - Leaderboards
 * 
 * Backend API is ONLY for WRITE operations:
 * - Creating posts
 * - Likes, comments, follows
 * - Image uploads
 * - ML verification triggers
 */

const GRAPH_URL = import.meta.env.VITE_GRAPH_URL || 'http://127.0.0.1:8000/subgraphs/name/eco-dms';

export const graphClient = new ApolloClient({
    link: new HttpLink({
        uri: GRAPH_URL,
    }),
    cache: new InMemoryCache({
        typePolicies: {
            Query: {
                fields: {
                    // Pagination for posts
                    posts: {
                        keyArgs: ['where', 'orderBy', 'orderDirection'],
                        merge(existing = [], incoming) {
                            return [...existing, ...incoming];
                        },
                    },
                    // Pagination for users
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
 * Used for fetching post content directly from IPFS
 */
export const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';

/**
 * Fetch content from IPFS
 * @param cid - IPFS Content Identifier
 * @returns Promise with post content
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
