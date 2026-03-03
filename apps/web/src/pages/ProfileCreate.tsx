import React from 'react'
import { Button, Card, Input } from '@eco-dms/ui'
import { useNavigate } from 'react-router-dom'
import { API_BASE, uploadImage } from '../api'

export function ProfileCreate({ address, onDone }: { address: string; onDone: () => void }) {
    const navigate = useNavigate()
    const [loading, setLoading] = React.useState(false)
    const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
    const [uploadingCover, setUploadingCover] = React.useState(false)
    const [error, setError] = React.useState('')
    const [username, setUsername] = React.useState('')
    const [bio, setBio] = React.useState('')
    const [dateOfBirth, setDateOfBirth] = React.useState('')
    const [location, setLocation] = React.useState('')
    const [profession, setProfession] = React.useState('')
    const [avatarCid, setAvatarCid] = React.useState('')
    const [coverPhotoCid, setCoverPhotoCid] = React.useState('')
    const [avatarPreview, setAvatarPreview] = React.useState('')
    const [coverPreview, setCoverPreview] = React.useState('')
    const [hasNewAvatarUpload, setHasNewAvatarUpload] = React.useState(false)
    const [hasNewCoverUpload, setHasNewCoverUpload] = React.useState(false)
    const [errors, setErrors] = React.useState<{ username?: string; dateOfBirth?: string }>({})

    const createMediaPost = async (token: string, mediaCid: string, content: string) => {
        const response = await fetch(`${API_BASE}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                author_wallet: address,
                content,
                media_cids: [mediaCid],
                tags: ['profile-update'],
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || `Failed to create media post: ${response.status}`)
        }
    }

    const resolveImageUrl = (value: string): string => {
        if (!value) return ''
        if (value.startsWith('http://') || value.startsWith('https://')) return value
        if (value.startsWith('ipfs://')) {
            return `https://ipfs.io/ipfs/${value.replace('ipfs://', '')}`
        }
        return `https://ipfs.io/ipfs/${value.replace('ipfs/', '').replace('/ipfs/', '')}`
    }

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            setUploadingAvatar(true)
            setError('')
            setAvatarPreview(URL.createObjectURL(file))
            const result = await uploadImage(file)
            setAvatarCid(result.cid)
            setHasNewAvatarUpload(true)
            const remotePreview = result.url || resolveImageUrl(result.cid)
            if (remotePreview) {
                setAvatarPreview(remotePreview)
            }
        } catch (err) {
            console.error('Avatar upload failed:', err)
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
            setError('')
            setCoverPreview(URL.createObjectURL(file))
            const result = await uploadImage(file)
            setCoverPhotoCid(result.cid)
            setHasNewCoverUpload(true)
            const remotePreview = result.url || resolveImageUrl(result.cid)
            if (remotePreview) {
                setCoverPreview(remotePreview)
            }
        } catch (err) {
            console.error('Cover upload failed:', err)
            setError('Failed to upload cover photo')
        } finally {
            setUploadingCover(false)
            event.target.value = ''
        }
    }

    const handleSave = async () => {
        setLoading(true)
        setError('')
        setErrors({})

        if (!username.trim()) {
            setErrors({ username: 'Username is required' })
            setLoading(false)
            return
        }

        if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
            setErrors({ dateOfBirth: 'Date of birth must be in YYYY-MM-DD format' })
            setLoading(false)
            return
        }

        const token = localStorage.getItem('auth_token')
        if (!token) {
            setError('Not authenticated')
            setLoading(false)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/api/users/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

            if (response.ok) {
                console.log('Profile created successfully')

                const postPromises: Promise<void>[] = []
                if (hasNewAvatarUpload && avatarCid) {
                    postPromises.push(createMediaPost(token, avatarCid, 'Updated profile photo'))
                }
                if (hasNewCoverUpload && coverPhotoCid) {
                    postPromises.push(createMediaPost(token, coverPhotoCid, 'Updated cover photo'))
                }

                if (postPromises.length > 0) {
                    const postResults = await Promise.allSettled(postPromises)
                    postResults.forEach((result) => {
                        if (result.status === 'rejected') {
                            console.error('Failed to create profile media post:', result.reason)
                        }
                    })
                    setHasNewAvatarUpload(false)
                    setHasNewCoverUpload(false)
                }

                onDone()
                navigate('/feed', { replace: true })
            } else {
                const errorData = await response.text()
                console.error('Failed to create profile:', errorData)
                setError(errorData || `Failed: ${response.status}`)
            }
        } catch (error) {
            console.error('Profile update failed:', error)
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card padding="lg" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>Create Profile</h2>
            <p style={{ marginBottom: 16, color: '#6b7280' }}>Welcome new user: {address.slice(0, 6)}...{address.slice(-4)}</p>

            {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

            <div style={{ marginBottom: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ height: 120, background: '#f3f4f6', position: 'relative' }}>
                    {coverPreview ? (
                        <img src={coverPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                            Cover photo preview
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontWeight: 600 }}>
                                {username.trim() ? username.charAt(0).toUpperCase() : 'U'}
                            </div>
                        )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{username.trim() || 'Your name'}</div>
                        <div style={{ fontSize: 14, color: '#6b7280' }}>{profession.trim() || 'Profession'}</div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{location.trim() || 'Location'}</div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{dateOfBirth.trim() || 'Date of birth'}</div>
                    </div>
                </div>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSave()
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>Profile photo</span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={uploadingAvatar || loading}
                        />
                        {uploadingAvatar && <span style={{ fontSize: 12, color: '#6b7280' }}>Uploading profile photo...</span>}
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>Cover photo</span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverUpload}
                            disabled={uploadingCover || loading}
                        />
                        {uploadingCover && <span style={{ fontSize: 12, color: '#6b7280' }}>Uploading cover photo...</span>}
                    </label>
                </div>

                <Input
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                    error={errors.username}
                />

                <Input
                    label="Bio"
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    multiline
                    numberOfLines={3}
                />

                <Input
                    label="Date of birth"
                    value={dateOfBirth}
                    onChangeText={setDateOfBirth}
                    placeholder="YYYY-MM-DD"
                    error={errors.dateOfBirth}
                />

                <Input
                    label="Location"
                    value={location}
                    onChangeText={setLocation}
                    placeholder="City, Country"
                />

                <Input
                    label="Profession"
                    value={profession}
                    onChangeText={setProfession}
                    placeholder="Software Engineer"
                />

                <Button
                    title={loading ? 'Saving...' : 'Save Profile'}
                    onPress={handleSave}
                    disabled={loading || uploadingAvatar || uploadingCover}
                    variant="primary"
                />
            </form>
        </Card>
    )
}