// The five menu items, in helix order from the top rung down.
export const RUNGS = [
  { name: 'Services', short: 'Services', href: '/services/' },
  { name: 'About', short: 'About', href: '/about/' },
  { name: 'Selected Work', short: 'Work', href: '/selected-work/' },
  { name: 'Blog', short: 'Blog', href: '/blog/' },
  { name: 'Contact', short: 'Contact', href: '/contact/' },
] as const;

// Which rung the camera zooms to for each top-level section. Anything unlisted (404s) uses Contact.
export const RUNG_FOR_SECTION: Record<string, number> = {
  services: 0,
  'ai-readiness': 0,
  about: 1,
  'selected-work': 2,
  blog: 3,
  contact: 4,
  'privacy-policy': 4,
};
export const FALLBACK_RUNG = 4;

export const rungForPath = (pathname: string): number => {
  const section = pathname.split('/').filter(Boolean)[0];
  if (!section) return -1;
  return RUNG_FOR_SECTION[section] ?? FALLBACK_RUNG;
};

export const CONTACT_EMAIL = 'info@dna4digital.com';
// Google Calendar appointment page for the free 30-minute call.
export const BOOKING_URL = 'https://calendar.app.google/ddE9Gz4PGV4dUWmJ7';
export const LINKEDIN_URL = 'https://www.linkedin.com/company/dna4digital/';

export const DISCLOSURE =
  'Daniel Nowak is an Associate Partner at Yameo B.V. Where a client engagement leads to software delivery by Yameo, I have a commercial interest in that work.';
