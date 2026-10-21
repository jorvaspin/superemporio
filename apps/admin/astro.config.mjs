import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react()],
  session: { driver: 'memory' },
  site: 'https://admin.superemporio.cl',
  // The workspace keeps its local secrets in the repository root. Astro runs
  // this app from apps/admin, so Vite needs an explicit env directory.
  vite: { envDir: '../..' },
});
