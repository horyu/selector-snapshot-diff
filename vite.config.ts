import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import playwrightApi from './plugins/playwrightApi';

export default defineConfig({
  plugins: [svelte(), playwrightApi()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
