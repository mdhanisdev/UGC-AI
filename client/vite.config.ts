import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [tailwindcss(), react()],
    build: {
        rollupOptions: {
            output: {
                // Split large, independent third-party libs into separate cacheable chunks.
                // React stays in the main vendor bundle to avoid circular chunk dependencies.
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('@clerk')) return 'clerk';
                        if (id.includes('framer-motion') || id.includes('lenis')) return 'motion';
                        return 'vendor';
                    }
                },
            },
        },
    },
});
