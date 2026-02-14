import React from 'react';
import {
    Modal as RNModal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ViewStyle,
    Platform,
} from 'react-native';
import { useTheme } from '../theme';

export interface ModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    style?: ViewStyle;
    testID?: string;
}

export const Modal: React.FC<ModalProps> = ({
    visible,
    onClose,
    title,
    children,
    style,
    testID,
}) => {
    const theme = useTheme();

    return (
        <RNModal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            testID={testID}
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={[
                        styles.modalContainer,
                        {
                            backgroundColor: theme.colors.background,
                            borderRadius: theme.borderRadius.lg,
                            padding: theme.spacing.lg,
                            maxWidth: Platform.OS === 'web' ? 500 : '90%',
                        },
                        style,
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {title && (
                        <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
                            <Text style={[
                                styles.title,
                                {
                                    color: theme.colors.text,
                                    fontSize: theme.typography.h3.fontSize,
                                    fontWeight: theme.typography.h3.fontWeight as any,
                                },
                            ]}>
                                {title}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Text style={[styles.closeText, { color: theme.colors.textSecondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.content}>{children}</View>
                </TouchableOpacity>
            </TouchableOpacity>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContainer: {
        width: '90%',
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 24,
        fontWeight: '300',
    },
    content: {
        width: '100%',
    },
});
