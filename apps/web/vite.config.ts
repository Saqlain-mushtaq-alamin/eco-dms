// filepath: d:\canvas\eco-dms\eco-dms\apps\web\vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: { port: 5173 }
})