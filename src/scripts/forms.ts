// Page widgets that need JS: the contact form (sent with fetch, posts normally without JS) and the AI readiness test.
// Both bind on every astro:page-load because pages are swapped in without a full reload.
import { navigate } from 'astro:transitions/client';
import { CONTACT_EMAIL } from '../data/site';

const ERRORS: Record<string, string> = {
  invalid: 'Please fill in your name, a valid email and a short message, and tick the privacy consent.',
  busy: 'Too many messages in a short time. Please wait a minute and try again.',
  error: `The message didn't go through. Please email ${CONTACT_EMAIL} instead.`,
};

function initContact() {
  const form = document.querySelector<HTMLFormElement>('form[data-contact]');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  const status = form.querySelector<HTMLElement>('.form-status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const field = <T extends Element>(name: string) => form.elements.namedItem(name) as T | null;

  const params = new URLSearchParams(location.search);
  const topic = params.get('topic');
  const topicSelect = field<HTMLSelectElement>('topic');
  if (topic && topicSelect && [...topicSelect.options].some(o => o.value === topic)) topicSelect.value = topic;
  const score = params.get('score');
  if (score && /^\d{1,3}$/.test(score)) {
    field<HTMLInputElement>('score')!.value = score;
    const message = field<HTMLTextAreaElement>('message')!;
    if (!message.value) message.value = `I took the AI readiness test and scored ${score}/100. `;
  }
  const error = params.get('error');
  if (error) showStatus(ERRORS[error] ?? ERRORS.error, true);
  field<HTMLInputElement>('started')!.value = String(Date.now());

  function showStatus(text: string, isError: boolean) {
    status.textContent = text;
    status.className = `form-status ${isError ? 'err' : 'ok'}`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    showStatus('Sending...', false);
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string };
      if (res.ok && data.ok) {
        navigate('/contact/thanks/');
        return;
      }
      showStatus(ERRORS[data.status ?? ''] ?? ERRORS.error, true);
    } catch {
      showStatus(ERRORS.error, true);
    }
    button.disabled = false;
  });
}

// ---------- AI readiness test ----------
const QUESTIONS: { q: string; a: string[] }[] = [
  { q: "How would you describe your organisation's data infrastructure today?", a: ['We collect and store very little data', 'We collect data but it is scattered and unorganised', 'We have structured databases, but they are poorly connected', 'We have a modern, integrated data platform with real-time processing'] },
  { q: "What is your team's current level of AI and machine-learning expertise?", a: ['No prior experience with AI tools', 'A few people understand the basics', 'We have dedicated data or ML specialists', 'We have an experienced AI team'] },
  { q: 'How are decisions made in your organisation?', a: ['Mostly on intuition and experience', 'A mix of intuition and basic reporting', 'Data-driven, with regular analytics', 'Highly data-driven, with predictive insight'] },
  { q: "What is your organisation's approach to new technology?", a: ['Cautious, and usually reactive', 'Selective, after a thorough evaluation', 'Proactive with proven technology', 'Innovation-led, often an early adopter'] },
  { q: 'How automated are your business processes?', a: ['Mostly manual, with little automation', 'Some automated workflows, many manual steps', 'Core processes are automated, with room to improve', 'Highly automated, with intelligent systems'] },
  { q: 'What budget do you set aside for digital transformation?', a: ['Very little budget for technology initiatives', 'A moderate budget with careful ROI checks', 'A substantial budget for strategic technology', 'A significant budget with room for innovation'] },
  { q: 'How does your organisation handle change?', a: ['Change is often resisted and hard to land', 'We manage change reactively, when we have to', 'We have structured change management in place', 'We are agile and adapt to continuous change'] },
  { q: 'What are your main business goals for the next two to three years?', a: ['Hold our current position and operations', 'Steady growth with better efficiency', 'Significant growth and expansion into new markets', 'Market leadership through innovation'] },
];

const RESULTS = [
  { max: 39, title: 'AI Beginner', text: 'A good place to start. The biggest wins will come from getting the basics right before buying any AI tool.', recs: ['Map how your core processes actually run today, and write down who owns each step', 'Get your key data into one place and agree what the main terms mean', 'Run a small, low-risk pilot on one repetitive task', 'Give leadership a short, practical grounding in what AI can and cannot do'] },
  { max: 69, title: 'AI Ready', text: 'You have solid foundations. The risk now is automating processes that are not yet clean.', recs: ['Rank your process friction points by what they cost you', 'Fix the handoffs and definitions before automating them', 'Launch two or three targeted pilots with clear success measures', 'Train the people who will run the new workflows, on your own data'] },
  { max: 100, title: 'AI Advanced', text: 'You are well placed for AI-driven change. The work is scaling what works and keeping it governed.', recs: ['Scale the pilots that proved their value across teams', 'Put governance in place: policies, ownership and audit trails', 'Look for custom solutions where off-the-shelf tools fall short', 'Measure adoption, not just deployment'] },
];

function initQuiz() {
  const found = document.querySelector<HTMLElement>('[data-quiz]');
  if (!found || found.dataset.bound) return;
  const box = found;
  box.dataset.bound = '1';
  const answers: number[] = [];
  const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

  function renderQuestion(moveFocus = true) {
    const i = answers.length;
    const pct = Math.round((i / QUESTIONS.length) * 100);
    box.innerHTML = `
      <div class="count">Question ${i + 1} of ${QUESTIONS.length}</div>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <fieldset>
        <legend>${esc(QUESTIONS[i].q)}</legend>
        ${QUESTIONS[i].a.map((a, v) => `<button type="button" class="opt" data-v="${v + 1}">${esc(a)}</button>`).join('')}
      </fieldset>
      <div class="nav">${i > 0 ? '<button type="button" class="linkbtn" data-back>&larr; Previous question</button>' : '<span></span>'}</div>`;
    box.querySelectorAll<HTMLButtonElement>('.opt').forEach(b => b.addEventListener('click', () => {
      answers.push(Number(b.dataset.v));
      answers.length === QUESTIONS.length ? renderResult() : renderQuestion();
    }));
    box.querySelector('[data-back]')?.addEventListener('click', () => { answers.pop(); renderQuestion(); });
    if (moveFocus) box.querySelector<HTMLButtonElement>('.opt')?.focus({ preventScroll: true });
  }

  function renderResult() {
    const score = Math.round((answers.reduce((s, v) => s + v, 0) / (QUESTIONS.length * 4)) * 100);
    const r = RESULTS.find(x => score <= x.max)!;
    box.innerHTML = `
      <div class="result" tabindex="-1">
        <div class="count">Your AI readiness score</div>
        <div class="score">${score}<span style="font-size:24px;color:var(--muted)">/100</span></div>
        <h2>${r.title}</h2>
        <p>${r.text}</p>
        <h3>Where I would start</h3>
        <ul class="ticks">${r.recs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="btnrow">
          <a class="btn btn-primary" href="/contact/?topic=audit&amp;score=${score}">Get my individual strategy</a>
          <button type="button" class="btn btn-ghost" data-restart>Start over</button>
        </div>
      </div>`;
    box.querySelector('[data-restart]')!.addEventListener('click', () => { answers.length = 0; renderQuestion(); });
    box.querySelector<HTMLElement>('.result')!.focus({ preventScroll: true });
  }

  renderQuestion(false);
}

document.addEventListener('astro:page-load', () => {
  initContact();
  initQuiz();
});
