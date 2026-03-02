import { createContext, useContext } from 'react';

export interface Theme {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        backgroundDark: string;
        surface: string;
        surfaceDark: string;
        text: string;
        textSecondary: string;
        textLight: string;
        border: string;
        borderLight: string;
        error: string;
        success: string;
        warning: string;
        // Glassmorphism
        glass: {
            background: string;
            backgroundDark: string;
            border: string;
            shadow: string;
        };
    };
    spacing: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
        xxl: number;
    };
    borderRadius: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
        full: number;
    };
    typography: {
        h1: { fontSize: number; fontWeight: string };
        h2: { fontSize: number; fontWeight: string };
        h3: { fontSize: number; fontWeight: string };
        h4: { fontSize: number; fontWeight: string };
        body: { fontSize: number; fontWeight: string };
        bodyLarge: { fontSize: number; fontWeight: string };
        caption: { fontSize: number; fontWeight: string };
    };
    effects: {
        glassmorphism: {
            backdropBlur: number;
            opacity: number;
            borderOpacity: number;
        };
    };
}

export const theme: Theme = {
    colors: {
        // Main colors
        primary: '#abca2f', // Lime green accent
        secondary: '#ffffff', // White
        accent: '#010203', // Near black

        // Backgrounds
        background: '#ffffff',
        backgroundDark: '#010203',

        // Surfaces
        surface: '#f1f1f1', // Light neutral
        surfaceDark: '#1d1e1f', // Medium dark neutral

        // Text colors
        text: '#010203', // Near black for light mode
        textSecondary: '#1d1e1f', // Medium dark
        textLight: '#ffffff', // White text for dark backgrounds

        // Borders
        border: '#0e0e0e', // Dark neutral
        borderLight: '#f1f1f1',

        // Status colors
        error: '#ef4444',
        success: '#abca2f',
        warning: '#f59e0b',

        // Glassmorphism
        glass: {
            background: 'rgba(241, 241, 241, 0.5)', // Light glass
            backgroundDark: 'rgba(29, 30, 31, 0.5)', // Dark glass
            border: 'rgba(255, 255, 255, 0.18)',
            shadow: 'rgba(0, 0, 0, 0.1)',
        },
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 6,
        md: 12,
        lg: 16,
        xl: 24,
        full: 9999,
    },
    typography: {
        h1: { fontSize: 36, fontWeight: '700' },
        h2: { fontSize: 28, fontWeight: '600' },
        h3: { fontSize: 22, fontWeight: '600' },
        h4: { fontSize: 18, fontWeight: '600' },
        body: { fontSize: 16, fontWeight: '400' },
        bodyLarge: { fontSize: 18, fontWeight: '400' },
        caption: { fontSize: 14, fontWeight: '400' },
    },
    effects: {
        glassmorphism: {
            backdropBlur: 10,
            opacity: 0.5,
            borderOpacity: 0.18,
        },
    },
};

const ThemeContext = createContext<Theme>(theme);

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => useContext(ThemeContext);
