import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT: For physical iPhone/Android device, use your computer's local network IP
// Find your IP: Run 'ipconfig' in Windows PowerShell and look for IPv4 Address
// For emulator: use 127.0.0.1
const API_BASE = 'http://192.168.0.102:8000';

async function getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
}

async function setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem('auth_token', token);
}

async function removeAuthToken(): Promise<void> {
    await AsyncStorage.removeItem('auth_token');
}

// ====================
// SIWE Authentication
// ====================

export async function getNonce() {
    const res = await fetch(`${API_BASE}/api/siwe/nonce`);
    if (!res.ok) throw new Error('Failed to get nonce');
    return res.json();
}

export async function prepareMessage(address: string, chainId: number, nonce: string) {
    const res = await fetch(`${API_BASE}/api/siwe/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chain_id: chainId, nonce }),
    });
    if (!res.ok) throw new Error('Failed to prepare message');
    return res.json();
}

export async function verifySignature(message: string, signature: string) {
    const res = await fetch(`${API_BASE}/api/siwe/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
    });
    if (!res.ok) throw new Error('Verification failed');

    const data = await res.json();

    // Store the JWT token
    if (data.token) {
        await setAuthToken(data.token);
        console.log('Token stored');
    }

    return data;
}

// ====================
// User Profile API
// ====================

export async function getMe() {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        if (res.status === 401) {
            await removeAuthToken();
        }
        throw new Error('Failed to fetch profile');
    }
    return res.json();
}

export async function createOrUpdateProfile(data: {
    username: string;
    bio?: string;
    avatar_cid?: string;
}) {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
}

export async function logout() {
    await removeAuthToken();
}

// ====================
// Posts API
// ====================

export async function createPost(authorWallet: string, content: string, mediaCids: string[] = []) {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            author_wallet: authorWallet,
            content,
            media_cids: mediaCids,
            tags: [],
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Failed to create post: ${res.status}`);
    }
    return res.json();
}

export async function fetchPosts(walletAddress: string) {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE}/api/posts/${walletAddress}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Failed to load posts: ${res.status}`);
    }
    return res.json();
}

export async function toggleLike(postCid: string, isLiked: boolean) {
    const token = await getAuthToken();
    const method = isLiked ? 'DELETE' : 'POST';
    const res = await fetch(`${API_BASE}/api/posts/${postCid}/like`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Failed to ${isLiked ? 'unlike' : 'like'} post`);
    }
    return res.json();
}

export async function uploadImage(imageUri: string) {
    const token = await getAuthToken();

    // Create form data
    const formData = new FormData();
    formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
    } as any);

    const res = await fetch(`${API_BASE}/api/upload/image`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Upload failed');
    }

    return res.json();
}

// Export for external use
export { getAuthToken, setAuthToken, removeAuthToken, API_BASE };
