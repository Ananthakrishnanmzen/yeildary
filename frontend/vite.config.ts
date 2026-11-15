import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DJANGO_DEV_SERVER = 'http://127.0.0.1:8000';

// In development keep VITE_API_BASE_URL=/api (see frontend/.env). Requests stay
// same-origin and are proxied here, so there is no CORS or host/port mismatch
// to configure - including when the dev server is reached through a tunnel.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: DJANGO_DEV_SERVER,
        changeOrigin: true,
      },
      // Server-rendered Django pages linked from the React app.
      '/password-reset': {
        target: DJANGO_DEV_SERVER,
        changeOrigin: true,
      },
      '/reset': {
        target: DJANGO_DEV_SERVER,
        changeOrigin: true,
      },
      '/terms': {
        target: DJANGO_DEV_SERVER,
        changeOrigin: true,
      },
      '/privacy': {
        target: DJANGO_DEV_SERVER,
        changeOrigin: true,
      },
    },
  },
});
