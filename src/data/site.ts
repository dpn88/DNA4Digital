import { ROUTES, ui, type Lang } from '../i18n';

// The five menu items, in helix order from the top rung down.
const RUNG_ROUTES = [ROUTES.services, ROUTES.about, ROUTES.work, ROUTES.blog, ROUTES.contact];
export const rungs = (lang: Lang) =>
  RUNG_ROUTES.map((route, i) => ({ name: ui(lang).rungs[i], short: ui(lang).rungsShort[i], href: route[lang] }));

// Which rung the camera zooms to for each top-level section, in both languages. Anything unlisted (404s) uses Contact.
export const RUNG_FOR_SECTION: Record<string, number> = {
  services: 0, uslugi: 0, 'ai-readiness': 0, 'test-gotowosci-ai': 0,
  about: 1, 'o-mnie': 1,
  'selected-work': 2, realizacje: 2,
  blog: 3,
  contact: 4, kontakt: 4, 'privacy-policy': 4, 'polityka-prywatnosci': 4,
};
export const FALLBACK_RUNG = 4;

export const rungForPath = (pathname: string): number => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'pl') parts.shift();
  if (!parts[0]) return -1;
  return RUNG_FOR_SECTION[parts[0]] ?? FALLBACK_RUNG;
};

export const CONTACT_EMAIL = 'info@dna4digital.com';
// Google Calendar appointment page for the free 30-minute call.
export const BOOKING_URL = 'https://calendar.app.google/ddE9Gz4PGV4dUWmJ7';
export const LINKEDIN_URL = 'https://www.linkedin.com/company/dna4digital/';
// Google Tag Manager container (GA4 + Leadinfo). Only loaded after the visitor consents; see src/scripts/prefs.ts.
export const GTM_ID = 'GTM-WC99BH8N';
