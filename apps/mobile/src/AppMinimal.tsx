import * as React from 'react';
import { View, Text } from 'react-native';

export default function AppMinimal() {
    return (
        <View style={{ flex: 1, backgroundColor: '#FF6B6B', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>
                MINIMAL APP WORKS
            </Text>
        </View>
    );
}
