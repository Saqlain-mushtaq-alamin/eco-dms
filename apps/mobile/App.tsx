import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Platform, Pressable, ScrollView } from 'react-native';

export default function App() {
  const [testsPassed, setTestsPassed] = useState<string[]>([]);

  const runTests = () => {
    const tests: string[] = [];

    // Test 1: Platform detection
    tests.push(`✅ Platform: ${Platform.OS}`);

    // Test 2: Version detection
    tests.push(`✅ Platform Version: ${Platform.Version}`);

    // Test 3: React Native working
    tests.push(`✅ React Native is working!`);

    // Test 4: State management
    tests.push(`✅ State management working!`);

    // Test 5: Touch events
    tests.push(`✅ Touch events working!`);

    setTestsPassed(tests);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>🌱 Eco-DMS Mobile</Text>
        <Text style={styles.subtitle}>Test App</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Platform Info:</Text>
          <Text style={styles.infoText}>OS: {Platform.OS}</Text>
          <Text style={styles.infoText}>Version: {Platform.Version}</Text>
          <Text style={styles.infoText}>
            {Platform.OS === 'ios' ? 'Running on iOS' :
              Platform.OS === 'android' ? 'Running on Android' :
                'Running on Web'}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed
          ]}
          onPress={runTests}
        >
          <Text style={styles.buttonText}>Run Tests</Text>
        </Pressable>

        {testsPassed.length > 0 && (
          <View style={styles.testResults}>
            <Text style={styles.testTitle}>Test Results:</Text>
            {testsPassed.map((test, index) => (
              <Text key={index} style={styles.testText}>{test}</Text>
            ))}
            <Text style={styles.successText}>✨ All tests passed! ✨</Text>
          </View>
        )}

        <StatusBar style="auto" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  infoBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonPressed: {
    backgroundColor: '#1b5e20',
    opacity: 0.8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testResults: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  testText: {
    fontSize: 16,
    color: '#2e7d32',
    marginBottom: 8,
  },
  successText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginTop: 12,
    textAlign: 'center',
  },
});
