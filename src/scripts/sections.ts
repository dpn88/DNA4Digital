// Marks the section being read in the "On this page" rail (src/components/Panel.astro): the last heading
// that has passed the top third of the screen. A section picked in the rail stays marked until the visitor
// scrolls by hand, because near the bottom of a page its heading may never reach that line.
let pairs: { link: HTMLAnchorElement; head: HTMLElement }[] = [];
let picked = -1;
let queued = false;

function update() {
  queued = false;
  const line = innerHeight * .3;
  let current = picked;
  if (current < 0) pairs.forEach((p, i) => { if (p.head.getBoundingClientRect().top < line) current = i; });
  pairs.forEach((p, i) => (i === current ? p.link.setAttribute('aria-current', 'true') : p.link.removeAttribute('aria-current')));
}
const queue = () => { if (pairs.length && !queued) { queued = true; requestAnimationFrame(update); } };

document.addEventListener('astro:page-load', () => {
  picked = -1;
  pairs = [...document.querySelectorAll<HTMLAnchorElement>('.panel-rail a')].flatMap(link => {
    const head = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    return head ? [{ link, head }] : [];
  });
  pairs.forEach((p, i) => p.link.addEventListener('click', () => { picked = i; queue(); }));
  update();
});

addEventListener('scroll', queue, { passive: true });
for (const type of ['wheel', 'touchstart', 'keydown']) addEventListener(type, () => { picked = -1; }, { passive: true });
