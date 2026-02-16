import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

// Screens
import SignInScreen from '../screens/SignInScreen';
import CreateProfileScreen from '../screens/CreateProfileScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VisitProfileScreen from '../screens/VisitProfileScreen';
import DashboardScreen from '../screens/DashboardScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function Navigation() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Feed"
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#10b981',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
                <Stack.Screen
                    name="SignIn"
                    component={SignInScreen}
                    options={{ title: '🌱 Eco DMS - Sign In' }}
                />
                <Stack.Screen
                    name="CreateProfile"
                    component={CreateProfileScreen}
                    options={{ title: 'Create Profile' }}
                />
                <Stack.Screen
                    name="Feed"
                    component={FeedScreen}
                    options={{ title: '🌱 Feed' }}
                />
                <Stack.Screen
                    name="Profile"
                    component={ProfileScreen}
                    options={{ title: 'My Profile' }}
                />
                <Stack.Screen
                    name="VisitProfile"
                    component={VisitProfileScreen}
                    options={{ title: 'Profile' }}
                />
                <Stack.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{ title: '🌱 Dashboard' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
