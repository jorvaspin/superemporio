import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react()],
  // Supabase owns authenticated sessions; Astro does not need a Cloudflare KV binding.
  session: { driver: 'memory' },
  site: 'https://www.superemporio.cl',
  vite: {
    resolve: {
      // React 19's browser SSR bundle requires MessageChannel, which is not
      // available while Cloudflare validates a Pages Function at startup.
      alias: { 'react-dom/server': 'react-dom/server.edge' },
    },
  },
});
