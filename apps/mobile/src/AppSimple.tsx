import React from 'react';
import { View, Text } from 'react-native';

export default function AppSimple() {
    console.log('AppSimple component rendering...');
    
    return (
        <View style={{
            flex: 1,
            backgroundColor: '#10b981',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <Text style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: 'white',
            }}>
                ✅ SUCCESS
            </Text>
            <Text style={{
                fontSize: 18,
                color: 'white',
                marginTop: 20,
            }}>
                Eco DMS Mobile Running!
            </Text>
        </View>
    );
}
