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

// The same page in the other language. A blog post with no `alternate` falls back to the other blog index.
export function alternatePath(pathname: string, to: Lang): string {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const pair of Object.values(ROUTES)) {
    if (pair.en === path || pair.pl === path) return pair[to];
  }
  if (path.startsWith('/blog/') || path.startsWith('/pl/blog/')) return langFromPath(path) === to ? path : ROUTES.blog[to];
  return ROUTES.home[to];
}

const UI = {
  en: {
    locale: 'en_GB',
    dateLocale: 'en-GB',
    skip: 'Skip to content',
    homeAria: 'DNA4Digital, home',
    bookCall: 'Book a call',
    back: 'Home',
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
    post: {
      minRead: 'min read',
      allPosts: 'All posts',
      bookCall: 'Book a free 30-min call',
      ctaHeading: 'Check where your company stands',
      ctaBody: 'The AI readiness test asks eight questions and takes two minutes. You get a score and four steps to start with.',
      ctaButton: 'Take the AI readiness test',
    },
  },
  pl: {
    locale: 'pl_PL',
    dateLocale: 'pl-PL',
    skip: 'Przejdź do treści',
    homeAria: 'DNA4Digital, strona główna',
    bookCall: 'Umów rozmowę',
    back: 'Strona główna',
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
    post: {
      minRead: 'min czytania',
      allPosts: 'Wszystkie wpisy',
      bookCall: 'Umów bezpłatną rozmowę (30 min)',
      ctaHeading: 'Sprawdź, na jakim etapie jest Twoja firma',
      ctaBody: 'Test gotowości AI to osiem pytań i dwie minuty. Na koniec dostajesz wynik i cztery kroki na start.',
      ctaButton: 'Zrób test gotowości AI',
    },
  },
} as const;

export const ui = (lang: Lang) => UI[lang];

// Post dates are calendar dates stored as UTC midnight, so format them in UTC whatever the build machine's zone is.
export const formatDate = (date: Date, lang: Lang) =>
  date.toLocaleDateString(UI[lang].dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
