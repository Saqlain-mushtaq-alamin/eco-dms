// filepath: d:\canvas\eco-dms\eco-dms\apps\mobile\src\components\MetaMaskDeepLinkButton.tsx
import React from 'react'
import { Linking, Button } from 'react-native'

// Deep link example (user must paste signature back in a real implementation)
export function MetaMaskDeepLinkButton() {
  return (
    <Button
      title="Open MetaMask"
      onPress={() => Linking.openURL('metamask://')}
    />
  )
}