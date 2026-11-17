import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages rendered with `noindex` (the form thank-you pages). Search Console flags any of them listed in the sitemap.
const NOINDEX_PAGES = ['/contact/thanks/', '/pl/kontakt/dziekuje/'];

export default defineConfig({
  site: 'https://dna4digital.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: page => !NOINDEX_PAGES.some(path => page.endsWith(path)) })],
});
