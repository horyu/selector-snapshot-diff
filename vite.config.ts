import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const parsePort = (value: string | undefined, fallback: number): number => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const webPort = parsePort(env.WEB_PORT, 5173);
  const capturePort = parsePort(env.CAPTURE_PORT, 5174);

  return {
    plugins: [
      svelte({
        compilerOptions: {
          runes: true,
        },
      }),
    ],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': `http://127.0.0.1:${capturePort}`,
      },
    },
  };
});
