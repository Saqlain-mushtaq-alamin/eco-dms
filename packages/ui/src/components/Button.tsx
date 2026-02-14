import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

export interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    style,
    testID,
}) => {
    const theme = useTheme();

    const buttonStyles: ViewStyle = {
        ...styles.base,
        backgroundColor:
            variant === 'primary'
                ? theme.colors.primary
                : variant === 'secondary'
                    ? theme.colors.secondary
                    : variant === 'outline'
                        ? 'transparent'
                        : 'transparent',
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: variant === 'outline' ? theme.colors.primary : 'transparent',
        paddingVertical: size === 'sm' ? theme.spacing.sm : size === 'md' ? theme.spacing.md : theme.spacing.lg,
        paddingHorizontal: size === 'sm' ? theme.spacing.md : size === 'md' ? theme.spacing.lg : theme.spacing.xl,
        borderRadius: theme.borderRadius.md,
        opacity: disabled ? 0.5 : 1,
    };

    const textStyles: TextStyle = {
        color:
            variant === 'primary' || variant === 'secondary'
                ? '#ffffff'
                : theme.colors.primary,
        fontSize: size === 'sm' ? 14 : size === 'md' ? 16 : 18,
        fontWeight: '600',
        textAlign: 'center',
    };

    return (
        <TouchableOpacity
            style={[buttonStyles, style]}
            onPress={onPress}
            disabled={disabled || loading}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled: disabled || loading }}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'outline' ? theme.colors.primary : '#ffffff'} />
            ) : (
                <Text style={textStyles}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
});
