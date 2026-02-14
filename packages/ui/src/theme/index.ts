import { createContext, useContext } from 'react';

export interface Theme {
    colors: {
        primary: string;
        secondary: string;
        background: string;
        surface: string;
        text: string;
        textSecondary: string;
        border: string;
        error: string;
        success: string;
        warning: string;
    };
    spacing: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
    };
    borderRadius: {
        sm: number;
        md: number;
        lg: number;
        full: number;
    };
    typography: {
        h1: { fontSize: number; fontWeight: string };
        h2: { fontSize: number; fontWeight: string };
        h3: { fontSize: number; fontWeight: string };
        body: { fontSize: number; fontWeight: string };
        caption: { fontSize: number; fontWeight: string };
    };
}

export const theme: Theme = {
    colors: {
        primary: '#10b981', // green-500
        secondary: '#3b82f6', // blue-500
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#111827',
        textSecondary: '#6b7280',
        border: '#e5e7eb',
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        full: 9999,
    },
    typography: {
        h1: { fontSize: 32, fontWeight: '700' },
        h2: { fontSize: 24, fontWeight: '600' },
        h3: { fontSize: 20, fontWeight: '600' },
        body: { fontSize: 16, fontWeight: '400' },
        caption: { fontSize: 14, fontWeight: '400' },
    },
};

const ThemeContext = createContext<Theme>(theme);

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => useContext(ThemeContext);
