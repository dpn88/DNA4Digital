// Cookie consent (Google Consent Mode v2) and accessibility preferences, both kept in localStorage.
// The inline script in Site.astro applies stored choices before the first paint and only loads Google Tag Manager
// when the visitor has already said yes; this module runs the banner and the settings dialog.
// Keep CONSENT_KEY, A11Y_KEY, CONSENT_VERSION and CONSENT_MAX_AGE_MS in sync with that inline script.

export const CONSENT_KEY = 'dna4d-consent';
export const A11Y_KEY = 'dna4d-a11y';
const CONSENT_VERSION = 1; // bump to ask everyone again, e.g. after adding a new tool
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

type Consent = { v: number; analytics: boolean; marketing: boolean; ts: number };
export type A11y = { text: 0 | 1 | 2; still: boolean; no3d: boolean; contrast: boolean; links: boolean; spacing: boolean };
const A11Y_DEFAULT: A11y = { text: 0, still: false, no3d: false, contrast: false, links: false, spacing: false };
const A11Y_CLASSES = ['still', 'contrast', 'links', 'spacing'] as const;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __loadGtm?: () => void;
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: choices apply for this page view only.
  }
}

// ---------- Consent ----------
function storedConsent(): Consent | null {
  const c = read<Consent>(CONSENT_KEY);
  if (!c || c.v !== CONSENT_VERSION || Date.now() - c.ts > CONSENT_MAX_AGE_MS) return null;
  return c;
}

const consentMode = (analytics: boolean, marketing: boolean) => {
  const state = (on: boolean) => (on ? 'granted' : 'denied');
  return { analytics_storage: state(analytics), ad_storage: state(marketing), ad_user_data: state(marketing), ad_personalization: state(marketing) };
};

// Analytics (_ga*) and HubSpot (__hs*, hubspotutk, messagesUtk) cookies, removed when consent is withdrawn.
function clearTrackingCookies() {
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (!/^(_ga|_gid|_gat|__hs|hubspotutk|messagesUtk)/.test(name)) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
  }
}

function saveConsent(analytics: boolean, marketing: boolean) {
  const before = storedConsent();
  write(CONSENT_KEY, { v: CONSENT_VERSION, analytics, marketing, ts: Date.now() } satisfies Consent);
  window.gtag?.('consent', 'update', consentMode(analytics, marketing));
  const withdrew = (before?.analytics && !analytics) || (before?.marketing && !marketing);
  if (withdrew) {
    // Scripts that already loaded can't be unloaded, so clear their cookies and start a clean page.
    clearTrackingCookies();
    location.reload();
    return;
  }
  if (analytics || marketing) window.__loadGtm?.();
  syncBanner();
}

function syncBanner() {
  const banner = document.getElementById('consent-banner');
  if (banner) banner.hidden = storedConsent() !== null;
}

// ---------- Accessibility ----------
export function storedA11y(): A11y {
  return { ...A11Y_DEFAULT, ...(read<Partial<A11y>>(A11Y_KEY) ?? {}) };
}

function applyA11y(a: A11y) {
  const root = document.documentElement.classList;
  root.toggle('a11y-text-1', a.text === 1);
  root.toggle('a11y-text-2', a.text === 2);
  for (const k of A11Y_CLASSES) root.toggle(`a11y-${k}`, a[k]);
}

function saveA11y(a: A11y, reload = false) {
  write(A11Y_KEY, a);
  applyA11y(a);
  if (reload) {
    location.reload();
    return;
  }
  const status = document.querySelector<HTMLElement>('.prefs-status');
  if (status) {
    status.textContent = status.dataset.savedText ?? '';
    window.setTimeout(() => (status.textContent = ''), 1500);
  }
}

// ---------- Settings dialog ----------
const dialog = () => document.getElementById('prefs-dialog') as HTMLDialogElement | null;

function fillDialog(d: HTMLDialogElement) {
  const c = storedConsent();
  const a = storedA11y();
  const box = (name: string) => d.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  box('analytics')!.checked = !!c?.analytics;
  box('marketing')!.checked = !!c?.marketing;
  for (const k of ['still', 'no3d', 'contrast', 'links', 'spacing'] as const) box(k)!.checked = a[k];
  d.querySelectorAll<HTMLInputElement>('input[name="text"]').forEach(r => (r.checked = Number(r.value) === a.text));
}

function selectTab(d: HTMLDialogElement, tab: string, focus = false) {
  d.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach(t => {
    const on = t.dataset.tab === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  d.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach(p => (p.hidden = p.id !== `prefs-pane-${tab}`));
}

function openSettings(tab: string) {
  const d = dialog();
  if (!d) return;
  fillDialog(d);
  selectTab(d, tab);
  d.showModal();
}

document.addEventListener('click', e => {
  const el = (e.target as Element | null)?.closest<HTMLElement>('[data-consent], [data-open-settings], [data-close-settings], [data-tab], [data-a11y-reset]');
  if (!el) return;
  const d = dialog();
  if (el.dataset.openSettings) return openSettings(el.dataset.openSettings);
  if (el.hasAttribute('data-close-settings')) return d?.close();
  if (el.dataset.tab && d) return selectTab(d, el.dataset.tab);
  if (el.hasAttribute('data-a11y-reset')) {
    const hadNo3d = storedA11y().no3d;
    saveA11y({ ...A11Y_DEFAULT }, hadNo3d);
    if (d) fillDialog(d);
    return;
  }
  const choice = el.dataset.consent;
  if (choice === 'all') saveConsent(true, true);
  else if (choice === 'none') saveConsent(false, false);
  else if (choice === 'save' && d) {
    const box = (name: string) => d.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.checked;
    saveConsent(box('analytics'), box('marketing'));
  }
  if (d?.open) d.close();
});

// Accessibility options apply the moment they change.
document.addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  if (!input.closest('#prefs-pane-a11y')) return;
  const a = storedA11y();
  if (input.name === 'text') a.text = Number(input.value) as A11y['text'];
  else if (input.name in A11Y_DEFAULT) (a as unknown as Record<string, boolean>)[input.name] = input.checked;
  saveA11y(a, input.name === 'no3d');
});

// Arrow keys move between the two tabs, as the ARIA tabs pattern expects.
document.addEventListener('keydown', e => {
  const tab = (e.target as Element | null)?.closest<HTMLElement>('[role="tab"]');
  const d = dialog();
  if (!tab || !d || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault();
  selectTab(d, tab.dataset.tab === 'privacy' ? 'a11y' : 'privacy', true);
});

// Astro replaces <html> attributes and the body on every page change, so re-apply both.
document.addEventListener('astro:after-swap', () => applyA11y(storedA11y()));
document.addEventListener('astro:page-load', syncBanner);
syncBanner();
