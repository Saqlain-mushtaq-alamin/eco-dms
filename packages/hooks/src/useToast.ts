import { useState, useCallback } from 'react';

export interface ToastOptions {
    id?: string;
    title?: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
}

interface Toast extends ToastOptions {
    id: string;
}

/**
 * Toast notification hook - provides platform-agnostic toast API
 * Platform-specific implementations should handle rendering
 */
export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const show = useCallback((options: ToastOptions) => {
        const id = options.id || Math.random().toString(36).substr(2, 9);
        const toast: Toast = {
            id,
            type: 'info',
            duration: 3000,
            ...options,
        };

        setToasts((prev) => [...prev, toast]);

        // Auto-dismiss
        if (toast.duration && toast.duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, toast.duration);
        }

        return id;
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = useCallback((message: string, title?: string) => {
        return show({ message, title, type: 'success' });
    }, [show]);

    const error = useCallback((message: string, title?: string) => {
        return show({ message, title, type: 'error', duration: 5000 });
    }, [show]);

    const warning = useCallback((message: string, title?: string) => {
        return show({ message, title, type: 'warning' });
    }, [show]);

    const info = useCallback((message: string, title?: string) => {
        return show({ message, title, type: 'info' });
    }, [show]);

    return {
        toasts,
        show,
        dismiss,
        success,
        error,
        warning,
        info,
    };
};
