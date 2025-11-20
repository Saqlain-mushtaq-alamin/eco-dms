// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\components\UserInfo.tsx
import React from 'react'
import { logout } from '../api'

export function UserInfo({ me, onRefresh }: { me: any, onRefresh: () => void }) {
    return (
        <div style={{ marginTop: 24 }}>
            <p>Signed in as: {me.address}</p>
            <button onClick={async () => { await logout(); onRefresh(); }}>Logout</button>
        </div>
    )
}