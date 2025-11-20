// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\components\MetaMaskButton.tsx
import React from 'react'

export const MetaMaskButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} style={{ padding: '10px 16px' }}>MetaMask Sign-In</button>
)