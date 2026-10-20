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
});
