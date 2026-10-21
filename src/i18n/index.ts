// Two languages: English at the site root, Polish under /pl/ with Polish slugs.
// ROUTES pairs every page with its counterpart, which drives the language switcher and hreflang tags.
export type Lang = 'en' | 'pl';
export const LANGS: Lang[] = ['en', 'pl'];

export const langFromPath = (pathname: string): Lang => (pathname === '/pl' || pathname.startsWith('/pl/') ? 'pl' : 'en');

export const ROUTES = {
  home: { en: '/', pl: '/pl/' },
  services: { en: '/services/', pl: '/pl/uslugi/' },
  about: { en: '/about/', pl: '/pl/o-mnie/' },
  work: { en: '/selected-work/', pl: '/pl/realizacje/' },
  blog: { en: '/blog/', pl: '/pl/blog/' },
  contact: { en: '/contact/', pl: '/pl/kontakt/' },
  thanks: { en: '/contact/thanks/', pl: '/pl/kontakt/dziekuje/' },
  readiness: { en: '/ai-readiness/', pl: '/pl/test-gotowosci-ai/' },
  privacy: { en: '/privacy-policy/', pl: '/pl/polityka-prywatnosci/' },
} as const satisfies Record<string, Record<Lang, string>>;
export type RouteKey = keyof typeof ROUTES;

// The same page in the other language. Blog posts fall back to the other blog index.
export function alternatePath(pathname: string, to: Lang): string {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const pair of Object.values(ROUTES)) {
    if (pair.en === path || pair.pl === path) return pair[to];
  }
  if (path.startsWith('/blog/') || path.startsWith('/pl/blog/')) return ROUTES.blog[to];
  return ROUTES.home[to];
}

const UI = {
  en: {
    locale: 'en_GB',
    skip: 'Skip to content',
    homeAria: 'DNA4Digital, back to the helix',
    bookCall: 'Book a call',
    back: 'Back to the helix',
    pagesNav: 'Pages',
    onThisPage: 'On this page',
    mainNav: 'Main',
    langNav: 'Language',
    rungs: ['Services', 'About', 'Selected Work', 'Blog', 'Contact'],
    rungsShort: ['Services', 'About', 'Work', 'Blog', 'Contact'],
    footer: { gtm: 'GTM & processes', training: 'Training', audits: 'Audits', readiness: 'AI readiness test', privacy: 'Privacy policy', disclosure: 'Yameo disclosure', privacyShort: 'Privacy', settings: 'Cookie & accessibility settings', settingsShort: 'Cookie settings' },
    settingsButton: 'Settings: privacy and accessibility',
    disclosure: 'Daniel Nowak is an Associate Partner at Yameo B.V. Where a client engagement leads to software delivery by Yameo, I have a commercial interest in that work.',
    rights: 'All rights reserved.',
  },
  pl: {
    locale: 'pl_PL',
    skip: 'Przejdź do treści',
    homeAria: 'DNA4Digital, powrót do helisy',
    bookCall: 'Umów rozmowę',
    back: 'Powrót do helisy',
    pagesNav: 'Strony',
    onThisPage: 'Na tej stronie',
    mainNav: 'Menu główne',
    langNav: 'Język',
    rungs: ['Usługi', 'O mnie', 'Realizacje', 'Blog', 'Kontakt'],
    rungsShort: ['Usługi', 'O mnie', 'Realizacje', 'Blog', 'Kontakt'],
    footer: { gtm: 'GTM i procesy', training: 'Szkolenia', audits: 'Audyty', readiness: 'Test gotowości AI', privacy: 'Polityka prywatności', disclosure: 'Informacja o Yameo', privacyShort: 'Prywatność', settings: 'Ustawienia cookie i dostępności', settingsShort: 'Ustawienia cookie' },
    settingsButton: 'Ustawienia: prywatność i dostępność',
    disclosure: 'Daniel Nowak jest Associate Partnerem w Yameo B.V. Jeśli współpraca z klientem prowadzi do realizacji oprogramowania przez Yameo, mam w tym interes handlowy.',
    rights: 'Wszelkie prawa zastrzeżone.',
  },
} as const;

export const ui = (lang: Lang) => UI[lang];
