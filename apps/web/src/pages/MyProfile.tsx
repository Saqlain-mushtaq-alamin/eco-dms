import React, { useEffect, useState } from 'react'
import { API_BASE, getMe, uploadImage } from '../api'
import { Button, Card, Input, PostCard, LoadingSpinner } from '@eco-dms/ui'

type Profile = {
    wallet_address: string
    username?: string
    bio?: string
    avatar_cid?: string
    cover_photo_cid?: string
    date_of_birth?: string
    location?: string
    profession?: string
    followers?: string[]
    following?: string[]
    [key: string]: any
}

type Post = {
    cid?: string
    author_wallet: string
    content: string
    media_cids?: string[]
    created_at: string
    likes_count?: number
    comments_count?: number
    liked_by_user?: boolean
}

interface UserProfileProps {
    address: string
    onBack: () => void
}

export default function UserProfile({ address, onBack }: UserProfileProps) {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [posts, setPosts] = useState<Post[]>([])
    const [editing, setEditing] = useState(false)
    const [username, setUsername] = useState('')
    const [bio, setBio] = useState('')
    const [dateOfBirth, setDateOfBirth] = useState('')
    const [location, setLocation] = useState('')
    const [profession, setProfession] = useState('')
    const [avatarCid, setAvatarCid] = useState('')
    const [coverPhotoCid, setCoverPhotoCid] = useState('')
    const [avatarPreview, setAvatarPreview] = useState('')
    const [coverPreview, setCoverPreview] = useState('')
    const [saving, setSaving] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [uploadingCover, setUploadingCover] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const resolveIpfsUrl = (value?: string): string | undefined => {
        if (!value) return undefined
        if (value.startsWith('http://') || value.startsWith('https://')) return value
        if (value.startsWith('ipfs://')) {
            return `https://ipfs.io/ipfs/${value.replace('ipfs://', '')}`
        }
        const clean = value.replace('ipfs/', '').replace('/ipfs/', '')
        return `https://ipfs.io/ipfs/${clean}`
    }

    const fetchMyPosts = async (walletAddress: string) => {
        const token = localStorage.getItem('auth_token') ?? ''
        if (!token) return

        try {
            const response = await fetch(`${API_BASE}/api/posts/${walletAddress}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })

            if (!response.ok) {
                throw new Error(`Failed to load posts: ${response.status}`)
            }

            const data = await response.json()
            setPosts(data.posts || [])
        } catch (err) {
            console.error('Failed to load user posts:', err)
            setPosts([])
        }
    }

    const fetchProfile = async () => {
        try {
            setLoading(true)
            const data = await getMe()
            console.log('Profile data:', data)
            setProfile(data)
            setUsername(data.username || '')
            setBio(data.bio || '')
            setDateOfBirth(data.date_of_birth || '')
            setLocation(data.location || '')
            setProfession(data.profession || '')
            setAvatarCid(data.avatar_cid || '')
            setCoverPhotoCid(data.cover_photo_cid || '')
            setAvatarPreview(resolveIpfsUrl(data.avatar_cid) || '')
            setCoverPreview(resolveIpfsUrl(data.cover_photo_cid) || '')
            await fetchMyPosts(data.wallet_address || address)
        } catch (err) {
            console.error('Fetch error:', err)
            setError('Failed to load profile. Please sign in again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (address) {
            fetchProfile()
        }
    }, [address])

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            setUploadingAvatar(true)
            setAvatarPreview(URL.createObjectURL(file))
            const result = await uploadImage(file)
            setAvatarCid(result.cid)
            setAvatarPreview(result.url || resolveIpfsUrl(result.cid) || '')
        } catch (err) {
            console.error('Avatar upload error:', err)
            setError('Failed to upload profile photo')
        } finally {
            setUploadingAvatar(false)
            event.target.value = ''
        }
    }

    const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            setUploadingCover(true)
            setCoverPreview(URL.createObjectURL(file))
            const result = await uploadImage(file)
            setCoverPhotoCid(result.cid)
            setCoverPreview(result.url || resolveIpfsUrl(result.cid) || '')
        } catch (err) {
            console.error('Cover upload error:', err)
            setError('Failed to upload cover photo')
        } finally {
            setUploadingCover(false)
            event.target.value = ''
        }
    }

    const save = async () => {
        try {
            const token = localStorage.getItem('auth_token')
            if (!token) {
                setError('Not authenticated')
                return
            }

            setSaving(true)

            const res = await fetch(`${API_BASE}/api/users/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    username: username.trim(),
                    bio: bio.trim(),
                    avatar_cid: avatarCid || undefined,
                    cover_photo_cid: coverPhotoCid || undefined,
                    date_of_birth: dateOfBirth || undefined,
                    location: location.trim() || undefined,
                    profession: profession.trim() || undefined,
                }),
            })
            if (res.ok) {
                setEditing(false)
                await fetchProfile()
            } else {
                setError('Failed to save profile')
            }
        } catch (err) {
            console.error('Save error:', err)
            setError('Failed to save profile')
        } finally {
            setSaving(false)
        }
    }

    if (!address) return <div className="p-6">Please sign in to view your profile.</div>
    if (loading) return <div className="p-6"><LoadingSpinner /></div>
    if (error) return <div className="p-6 text-red-600">{error}</div>
    if (!profile) return <div className="p-6">No profile data found.</div>

    return (
        <div className="p-6 space-y-5">
            <Card>
                <div className="relative">
                    <div className="h-52 w-full rounded-xl bg-gray-100 overflow-hidden">
                        {coverPreview ? (
                            <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400">Cover photo</div>
                        )}
                    </div>

                    <div className="mt-4 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 border-4 border-white -mt-12 shadow">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center font-semibold text-gray-600">
                                        {(username || address).charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="pt-1">
                                <h2 className="text-2xl font-semibold text-gray-900">{username || 'Unnamed user'}</h2>
                                <p className="text-gray-600">{profession || 'Profession not set'}</p>
                                <p className="text-gray-500 text-sm">{location || 'Location not set'}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {!editing ? (
                                <Button title="Edit Profile" onPress={() => setEditing(true)} />
                            ) : (
                                <>
                                    <Button title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving || uploadingAvatar || uploadingCover} />
                                    <Button title="Cancel" onPress={() => setEditing(false)} variant="outline" />
                                </>
                            )}
                            <Button title="Back to Feed" onPress={onBack} variant="secondary" />
                        </div>
                    </div>
                </div>
            </Card>

            {editing && (
                <Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-sm text-gray-700">
                            <div className="mb-1 font-medium">Profile photo</div>
                            <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar || saving} />
                            {uploadingAvatar && <div className="text-xs text-gray-500 mt-1">Uploading...</div>}
                        </label>
                        <label className="text-sm text-gray-700">
                            <div className="mb-1 font-medium">Cover photo</div>
                            <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploadingCover || saving} />
                            {uploadingCover && <div className="text-xs text-gray-500 mt-1">Uploading...</div>}
                        </label>
                    </div>
                    <div className="mt-4 space-y-3">
                        <Input label="Username" value={username} onChangeText={setUsername} placeholder="Username" />
                        <Input label="Bio" value={bio} onChangeText={setBio} placeholder="Bio" multiline numberOfLines={4} />
                        <Input label="Profession" value={profession} onChangeText={setProfession} placeholder="Profession" />
                        <Input label="Location" value={location} onChangeText={setLocation} placeholder="Location" />
                        <Input label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                    <Card>
                        <h3 className="text-lg font-semibold mb-3">Profile Info</h3>
                        <div className="space-y-2 text-sm text-gray-700">
                            <div><span className="font-medium">Wallet:</span> <span className="break-all">{profile.wallet_address}</span></div>
                            <div><span className="font-medium">Date of birth:</span> {profile.date_of_birth || '-'}</div>
                            <div><span className="font-medium">Location:</span> {profile.location || '-'}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t flex gap-6">
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{profile.followers?.length || 0}</div>
                                <div className="text-sm text-gray-500">Followers</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{profile.following?.length || 0}</div>
                                <div className="text-sm text-gray-500">Following</div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-8 space-y-3">
                    <h3 className="text-lg font-semibold">My Posts</h3>
                    {posts.length === 0 ? (
                        <Card>
                            <div className="text-gray-500">No posts yet.</div>
                        </Card>
                    ) : (
                        posts.map((post) => (
                            <PostCard
                                key={post.cid ?? post.created_at}
                                author={{
                                    address: profile.wallet_address,
                                    username: profile.username,
                                    avatarUri: resolveIpfsUrl(profile.avatar_cid),
                                }}
                                content={post.content || ''}
                                imageUri={post.media_cids?.[0] ? resolveIpfsUrl(post.media_cids[0]) : undefined}
                                timestamp={new Date(post.created_at).getTime()}
                                likes={post.likes_count || 0}
                                comments={post.comments_count || 0}
                                isLiked={Boolean(post.liked_by_user)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}