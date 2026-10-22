// Remembers a language picked with the EN/PL switch. The redirect in Site.astro then follows that choice
// instead of the browser language. Stored only in this browser; nothing is sent anywhere.
export const LANG_CHOICE_KEY = 'dna4d-lang';

document.addEventListener('click', e => {
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('.lang-switch a[hreflang]');
  if (!link) return;
  try {
    localStorage.setItem(LANG_CHOICE_KEY, link.hreflang);
  } catch {
    // Storage blocked: the switch still works, the choice just isn't remembered.
  }
});
