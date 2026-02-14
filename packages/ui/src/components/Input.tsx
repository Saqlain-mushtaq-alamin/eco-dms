import React from 'react';
import { TextInput, View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface InputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
    error?: string;
    secureTextEntry?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
    disabled?: boolean;
    style?: ViewStyle;
    testID?: string;
}

export const Input: React.FC<InputProps> = ({
    value,
    onChangeText,
    placeholder,
    label,
    error,
    secureTextEntry,
    multiline,
    numberOfLines,
    disabled,
    style,
    testID,
}) => {
    const theme = useTheme();

    const inputStyles: TextStyle = {
        ...styles.input,
        borderColor: error ? theme.colors.error : theme.colors.border,
        backgroundColor: disabled ? theme.colors.surface : theme.colors.background,
        color: theme.colors.text,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        fontSize: 16,
    };

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text style={[styles.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                    {label}
                </Text>
            )}
            <TextInput
                style={inputStyles}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                numberOfLines={numberOfLines}
                editable={!disabled}
                testID={testID}
            />
            {error && (
                <Text style={[styles.error, { color: theme.colors.error, marginTop: theme.spacing.xs }]}>
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    input: {
        borderWidth: 1,
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    error: {
        fontSize: 12,
    },
});
