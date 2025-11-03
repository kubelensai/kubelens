import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile'
  const isProduction = mode === 'production'
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Global esbuild options (applies to both dev and build)
    esbuild: {
      drop: isProduction ? ['console', 'debugger'] : [],
    },
    server: {
      port: 5173,
      // Only use proxy for web development
      proxy: !isMobile ? {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          ws: true, // Enable WebSocket proxying
        },
      } : undefined,
    },
    build: {
      // Mobile builds may need different optimization
      target: isMobile ? 'es2015' : 'modules',
      // Ensure sourcemaps for debugging
      sourcemap: mode === 'development',
      // Use esbuild for minification (faster than terser)
      minify: 'esbuild',
    },
  }
})

