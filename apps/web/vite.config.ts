// filepath: d:\canvas\eco-dms\eco-dms\apps\web\vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    server: { port: 5173 },
    resolve: {
        alias: {
            // Support React Native Web
            'react-native': 'react-native-web',
            // Shared packages
            '@eco-dms/ui': path.resolve(__dirname, '../../packages/ui/src'),
            '@eco-dms/hooks': path.resolve(__dirname, '../../packages/hooks/src'),
            '@eco-dms/services': path.resolve(__dirname, '../../packages/services/src'),
        },
        extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    },
    optimizeDeps: {
        exclude: ['@eco-dms/ui', '@eco-dms/hooks', '@eco-dms/services'],
    },
})