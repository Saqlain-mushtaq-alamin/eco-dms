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

export interface GlassButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    testID?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
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
                    : theme.colors.glass.background,
        borderWidth: variant === 'glass' ? 1 : 0,
        borderColor: variant === 'glass' ? theme.colors.glass.border : 'transparent',
        paddingVertical: size === 'sm' ? theme.spacing.sm : size === 'md' ? theme.spacing.md : theme.spacing.lg,
        paddingHorizontal: size === 'sm' ? theme.spacing.md : size === 'md' ? theme.spacing.lg : theme.spacing.xl,
        borderRadius: theme.borderRadius.md,
        opacity: disabled ? 0.5 : 1,
    };

    const textStyles: TextStyle = {
        color:
            variant === 'primary'
                ? theme.colors.accent
                : variant === 'secondary'
                    ? theme.colors.text
                    : theme.colors.text,
        fontSize: size === 'sm' ? 14 : size === 'md' ? 16 : 18,
        fontWeight: '600',
        textAlign: 'center',
    };

    const TouchableOpacityComponent = TouchableOpacity as unknown as React.ComponentType<any>;
    const ActivityIndicatorComponent = ActivityIndicator as unknown as React.ComponentType<any>;
    const TextComponent = Text as unknown as React.ComponentType<any>;

    return (
        <TouchableOpacityComponent
            style={[buttonStyles, variant === 'glass' && styles.glass, style]}
            onPress={onPress}
            disabled={disabled || loading}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled: disabled || loading }}
        >
            {loading ? (
                <ActivityIndicatorComponent
                    color={variant === 'primary' ? theme.colors.accent : theme.colors.primary}
                />
            ) : (
                <TextComponent style={textStyles}>{title}</TextComponent>
            )}
        </TouchableOpacityComponent>
    );
};

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    glass: {
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
});
