/**
 * GraphQL Service for subgraph queries
 */
export class GraphQLService {
    private endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint;
    }

    async query<T = any>(
        query: string,
        variables?: Record<string, any>
    ): Promise<T> {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables,
                }),
            });

            const result = await response.json();

            if (result.errors) {
                throw new Error(result.errors[0].message);
            }

            return result.data;
        } catch (error: any) {
            console.error('GraphQL query error:', error);
            throw error;
        }
    }

    // Common queries for Eco-DMS
    async getUserProfile(address: string) {
        const query = `
      query GetUserProfile($address: String!) {
        user(id: $address) {
          id
          address
          username
          bio
          ecoScore
          verifiedActions
          createdAt
        }
      }
    `;

        return this.query(query, { address: address.toLowerCase() });
    }

    async getUserPosts(address: string, limit: number = 20) {
        const query = `
      query GetUserPosts($address: String!, $limit: Int!) {
        posts(
          where: { author: $address }
          first: $limit
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          content
          imageUri
          timestamp
          likes
          comments
          author {
            id
            username
            avatarUri
          }
        }
      }
    `;

        return this.query(query, { address: address.toLowerCase(), limit });
    }

    async getVerifications(address: string) {
        const query = `
      query GetVerifications($address: String!) {
        verifications(
          where: { user: $address }
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          actionType
          status
          timestamp
          mlScore
          humanVerified
        }
      }
    `;

        return this.query(query, { address: address.toLowerCase() });
    }

    async getFeed(limit: number = 20, skip: number = 0) {
        const query = `
      query GetFeed($limit: Int!, $skip: Int!) {
        posts(
          first: $limit
          skip: $skip
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          content
          imageUri
          timestamp
          likes
          comments
          author {
            id
            address
            username
            avatarUri
          }
        }
      }
    `;

        return this.query(query, { limit, skip });
    }
}
