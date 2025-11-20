import React from 'react'
import { View, Text } from 'react-native'

export function Feed({ address }: { address: string }) {
    return (
        <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>Feed</Text>
            <Text>Signed in as {address}</Text>
            <Text>Social feed placeholder.</Text>
        </View>
    )
}