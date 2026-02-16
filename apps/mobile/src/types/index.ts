export type RootStackParamList = {
    SignIn: undefined;
    CreateProfile: undefined;
    Feed: undefined;
    Profile: undefined;
    VisitProfile: { address: string };
    Dashboard: undefined;
};

export type Post = {
    cid?: string;
    type: 'post';
    version: number;
    author_wallet: string;
    content: string;
    media_cids: string[];
    tags: string[];
    created_at: string;
    likes_count?: number;
    comments_count?: number;
    liked_by_user?: boolean;
    verified?: boolean;
    eco_score?: number;
    signed_verdict_cid?: string;
    verifier_address?: string;
    verified_at?: string;
};

export type UserProfile = {
    wallet_address: string;
    username: string;
    bio?: string;
    avatar_cid?: string;
    created_at: string;
};
