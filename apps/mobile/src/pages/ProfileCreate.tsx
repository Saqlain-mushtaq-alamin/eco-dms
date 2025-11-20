import React from 'react'
import { View, Text, Button } from 'react-native'

export function ProfileCreate({ address, onDone }: { address: string; onDone: () => void }) {
    return (
        <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>Create Profile</Text>
            <Text>Welcome new user: {address}</Text>
            <Text>Placeholder profile creation screen.</Text>
            <Button title="Finish" onPress={onDone} />
        </View>
    )
}