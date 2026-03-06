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
    const avatarInputRef = React.useRef<HTMLInputElement>(null)
    const coverInputRef = React.useRef<HTMLInputElement>(null)

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

                    <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover || loading}
                        title="Upload cover photo"
                        style={{
                            position: 'absolute',
                            right: 10,
                            top: 10,
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.8)',
                            background: 'rgba(17,24,39,0.62)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            boxShadow: '0 6px 14px rgba(0,0,0,0.24)',
                        }}
                    >
                        📸
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e5e7eb', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontWeight: 600 }}>
                                {username.trim() ? username.charAt(0).toUpperCase() : 'U'}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={uploadingAvatar || loading}
                            title="Upload profile photo"
                            style={{
                                position: 'absolute',
                                right: 0,
                                bottom: 0,
                                width: 22,
                                height: 22,
                                borderRadius: 999,
                                border: '1px solid #ffffff',
                                background: '#111827',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                padding: 0,
                            }}
                        >
                            📸
                        </button>
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{username.trim() || 'Your name'}</div>
                        <div style={{ fontSize: 14, color: '#6b7280' }}>{profession.trim() || 'Profession'}</div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{location.trim() || 'Location'}</div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{dateOfBirth.trim() || 'Date of birth'}</div>
                    </div>
                </div>
            </div>

            <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar || loading}
                style={{ display: 'none' }}
            />

            <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={uploadingCover || loading}
                style={{ display: 'none' }}
            />

            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSave()
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
                <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 12,
                    background: 'linear-gradient(140deg, #ffffff 0%, #f8fafc 100%)',
                    color: '#4b5563',
                    fontSize: 13,
                }}>
                    Use the <strong>+</strong> icons on the cover and profile placeholders to upload images.
                    {uploadingAvatar && <div style={{ marginTop: 6 }}>Uploading profile photo...</div>}
                    {uploadingCover && <div style={{ marginTop: 6 }}>Uploading cover photo...</div>}
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

                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Date of birth</span>
                    <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(event) => setDateOfBirth(event.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        style={{
                            height: 44,
                            borderRadius: 10,
                            border: errors.dateOfBirth ? '1px solid #ef4444' : '1px solid #d1d5db',
                            padding: '0 12px',
                            fontSize: 14,
                            color: '#111827',
                            background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
                        }}
                    />
                    {errors.dateOfBirth ? <span style={{ fontSize: 12, color: '#ef4444' }}>{errors.dateOfBirth}</span> : null}
                </label>

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