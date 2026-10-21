// Page widgets that need JS: the contact form (sent with fetch, posts normally without JS) and the AI readiness test.
// Both bind on every astro:page-load because pages are swapped in without a full reload, and both follow <html lang>.
import { navigate } from 'astro:transitions/client';
import { CONTACT_EMAIL } from '../data/site';
import { ROUTES, type Lang } from '../i18n';

const pageLang = (): Lang => (document.documentElement.lang === 'pl' ? 'pl' : 'en');

const FORM_TEXT = {
  en: {
    sending: 'Sending...',
    scorePrefill: (s: string) => `I took the AI readiness test and scored ${s}/100. `,
    errors: {
      invalid: 'Please fill in your name, a valid email and a short message, and tick the privacy consent.',
      busy: 'Too many messages in a short time. Please wait a minute and try again.',
      error: `The message didn't go through. Please email ${CONTACT_EMAIL} instead.`,
    } as Record<string, string>,
  },
  pl: {
    sending: 'Wysyłanie...',
    scorePrefill: (s: string) => `Mój wynik w teście gotowości AI: ${s}/100. `,
    errors: {
      invalid: 'Podaj imię, poprawny adres e-mail i krótką wiadomość oraz zaznacz zgodę na przetwarzanie danych.',
      busy: 'Za dużo wiadomości w krótkim czasie. Odczekaj minutę i spróbuj ponownie.',
      error: `Wiadomość nie dotarła. Napisz bezpośrednio na ${CONTACT_EMAIL}.`,
    } as Record<string, string>,
  },
};

function initContact() {
  const form = document.querySelector<HTMLFormElement>('form[data-contact]');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  const lang = pageLang();
  const text = FORM_TEXT[lang];
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
    if (!message.value) message.value = text.scorePrefill(score);
  }
  const error = params.get('error');
  if (error) showStatus(text.errors[error] ?? text.errors.error, true);
  field<HTMLInputElement>('started')!.value = String(Date.now());

  function showStatus(message: string, isError: boolean) {
    status.textContent = message;
    status.className = `form-status ${isError ? 'err' : 'ok'}`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    showStatus(text.sending, false);
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string };
      if (res.ok && data.ok) {
        navigate(ROUTES.thanks[lang]);
        return;
      }
      showStatus(text.errors[data.status ?? ''] ?? text.errors.error, true);
    } catch {
      showStatus(text.errors.error, true);
    }
    button.disabled = false;
  });
}

// ---------- AI readiness test ----------
type Result = { max: number; title: string; text: string; recs: string[] };
const QUIZ: Record<Lang, { questions: { q: string; a: string[] }[]; results: Result[]; ui: Record<string, string> }> = {
  en: {
    ui: { count: 'Question {n} of {total}', back: 'Previous question', yourScore: 'Your AI readiness score', start: 'Where I would start', cta: 'Get my individual strategy', restart: 'Start over' },
    questions: [
      { q: "How would you describe your organisation's data infrastructure today?", a: ['We collect and store very little data', 'We collect data but it is scattered and unorganised', 'We have structured databases, but they are poorly connected', 'We have a modern, integrated data platform with real-time processing'] },
      { q: "What is your team's current level of AI and machine-learning expertise?", a: ['No prior experience with AI tools', 'A few people understand the basics', 'We have dedicated data or ML specialists', 'We have an experienced AI team'] },
      { q: 'How are decisions made in your organisation?', a: ['Mostly on intuition and experience', 'A mix of intuition and basic reporting', 'Data-driven, with regular analytics', 'Highly data-driven, with predictive insight'] },
      { q: "What is your organisation's approach to new technology?", a: ['Cautious, and usually reactive', 'Selective, after a thorough evaluation', 'Proactive with proven technology', 'Innovation-led, often an early adopter'] },
      { q: 'How automated are your business processes?', a: ['Mostly manual, with little automation', 'Some automated workflows, many manual steps', 'Core processes are automated, with room to improve', 'Highly automated, with intelligent systems'] },
      { q: 'What budget do you set aside for digital transformation?', a: ['Very little budget for technology initiatives', 'A moderate budget with careful ROI checks', 'A substantial budget for strategic technology', 'A significant budget with room for innovation'] },
      { q: 'How does your organisation handle change?', a: ['Change is often resisted and hard to land', 'We manage change reactively, when we have to', 'We have structured change management in place', 'We are agile and adapt to continuous change'] },
      { q: 'What are your main business goals for the next two to three years?', a: ['Hold our current position and operations', 'Steady growth with better efficiency', 'Significant growth and expansion into new markets', 'Market leadership through innovation'] },
    ],
    results: [
      { max: 39, title: 'AI Beginner', text: "You'll get the biggest wins from sorting out the basics before you buy any AI tool.", recs: ['Map how your core processes run today, and write down who owns each step', 'Get your key data into one place and agree what the main terms mean', 'Run a small, low-risk pilot on one repetitive task', 'Give leadership a short, practical grounding in what AI can and cannot do'] },
      { max: 69, title: 'AI Ready', text: "Your foundations are solid. Your main risk now is automating processes that aren't clean yet.", recs: ['Rank your process friction points by what they cost you', 'Fix the handoffs and definitions before automating them', 'Launch two or three targeted pilots with clear success measures', 'Train the people who will run the new workflows, on your own data'] },
      { max: 100, title: 'AI Advanced', text: "You're well placed for AI-driven change. Your next job is scaling what works and keeping it governed.", recs: ['Scale the pilots that proved their value across teams', 'Put governance in place: policies, ownership and audit trails', 'Look for custom solutions where off-the-shelf tools fall short', 'Measure adoption as well as deployment'] },
    ],
  },
  pl: {
    ui: { count: 'Pytanie {n} z {total}', back: 'Poprzednie pytanie', yourScore: 'Twój wynik gotowości na AI', start: 'Od czego bym zaczął', cta: 'Odbierz indywidualną strategię', restart: 'Zacznij od nowa' },
    questions: [
      { q: 'Jak wygląda dziś infrastruktura danych w Twojej organizacji?', a: ['Zbieramy i przechowujemy bardzo mało danych', 'Zbieramy dane, ale są rozproszone i nieuporządkowane', 'Mamy uporządkowane bazy danych, ale słabo ze sobą połączone', 'Mamy nowoczesną, zintegrowaną platformę danych działającą w czasie rzeczywistym'] },
      { q: 'Jaki jest obecny poziom wiedzy Twojego zespołu o AI i uczeniu maszynowym?', a: ['Brak doświadczenia z narzędziami AI', 'Kilka osób zna podstawy', 'Mamy specjalistów od danych lub ML', 'Mamy doświadczony zespół AI'] },
      { q: 'Jak podejmowane są decyzje w Twojej organizacji?', a: ['Głównie na podstawie intuicji i doświadczenia', 'Na podstawie intuicji i prostych raportów', 'Na podstawie danych i regularnych analiz', 'W pełni w oparciu o dane, z analizą predykcyjną'] },
      { q: 'Jakie jest podejście Twojej organizacji do nowych technologii?', a: ['Ostrożne i zwykle reaktywne', 'Selektywne, po dokładnej ocenie', 'Proaktywne wobec sprawdzonych rozwiązań', 'Nastawione na innowacje, często wdrażamy je jako pierwsi'] },
      { q: 'Na ile zautomatyzowane są Twoje procesy biznesowe?', a: ['Głównie ręczne, z niewielką automatyzacją', 'Część jest zautomatyzowana, ale wiele kroków wciąż ręcznych', 'Kluczowe procesy są zautomatyzowane, ale jest co poprawiać', 'W dużym stopniu zautomatyzowane, z inteligentnymi systemami'] },
      { q: 'Jaki budżet przeznaczasz na transformację cyfrową?', a: ['Bardzo mały budżet na inicjatywy technologiczne', 'Umiarkowany budżet, z dokładną analizą zwrotu', 'Znaczący budżet na strategiczne technologie', 'Duży budżet z przestrzenią na innowacje'] },
      { q: 'Jak Twoja organizacja radzi sobie ze zmianą?', a: ['Zmiany często napotykają opór i trudno je wdrożyć', 'Zarządzamy zmianą reaktywnie, kiedy musimy', 'Mamy uporządkowany proces zarządzania zmianą', 'Jesteśmy zwinni i dostosowujemy się do ciągłych zmian'] },
      { q: 'Jakie są Twoje główne cele biznesowe na najbliższe dwa, trzy lata?', a: ['Utrzymać obecną pozycję i sposób działania', 'Stabilny wzrost i lepsza efektywność', 'Znaczący wzrost i wejście na nowe rynki', 'Pozycja lidera dzięki innowacjom'] },
    ],
    results: [
      { max: 39, title: 'Początek drogi z AI', text: 'Największe korzyści przyniesie Ci uporządkowanie podstaw, zanim kupisz jakiekolwiek narzędzie AI.', recs: ['Opisz, jak dziś działają Twoje kluczowe procesy i kto odpowiada za każdy krok', 'Zbierz najważniejsze dane w jednym miejscu i uzgodnij, co znaczą kluczowe pojęcia', 'Uruchom mały, bezpieczny pilotaż na jednym powtarzalnym zadaniu', 'Daj zarządowi krótkie, praktyczne wprowadzenie: co AI potrafi, a czego nie'] },
      { max: 69, title: 'Gotowość na AI', text: 'Masz solidne fundamenty. Twoje główne ryzyko to teraz automatyzacja procesów, które nie są jeszcze uporządkowane.', recs: ['Uszereguj punkty tarcia w procesach według tego, ile Cię kosztują', 'Napraw przekazania i definicje, zanim je zautomatyzujesz', 'Uruchom dwa lub trzy celowane pilotaże z jasnymi miarami sukcesu', 'Przeszkol osoby, które będą prowadzić nowe procesy, na Twoich własnych danych'] },
      { max: 100, title: 'Zaawansowanie w AI', text: 'Twoja organizacja jest dobrze przygotowana na zmiany oparte na AI. Twoim kolejnym zadaniem jest skalowanie tego, co działa, i utrzymanie nad tym kontroli.', recs: ['Skaluj pilotaże, które się sprawdziły, na kolejne zespoły', 'Wprowadź zasady: polityki, odpowiedzialność i ścieżki audytu', 'Szukaj rozwiązań szytych na miarę tam, gdzie gotowe narzędzia nie wystarczają', 'Mierz zarówno wdrożenie, jak i faktyczne użycie'] },
    ],
  },
};

function initQuiz() {
  const found = document.querySelector<HTMLElement>('[data-quiz]');
  if (!found || found.dataset.bound) return;
  const box = found;
  box.dataset.bound = '1';
  const lang = pageLang();
  const { questions, results, ui } = QUIZ[lang];
  const answers: number[] = [];
  const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

  function renderQuestion(moveFocus = true) {
    const i = answers.length;
    const pct = Math.round((i / questions.length) * 100);
    box.innerHTML = `
      <div class="count">${ui.count.replace('{n}', String(i + 1)).replace('{total}', String(questions.length))}</div>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <fieldset>
        <legend>${esc(questions[i].q)}</legend>
        ${questions[i].a.map((a, v) => `<button type="button" class="opt" data-v="${v + 1}">${esc(a)}</button>`).join('')}
      </fieldset>
      <div class="nav">${i > 0 ? `<button type="button" class="linkbtn" data-back>&larr; ${ui.back}</button>` : '<span></span>'}</div>`;
    box.querySelectorAll<HTMLButtonElement>('.opt').forEach(b => b.addEventListener('click', () => {
      answers.push(Number(b.dataset.v));
      answers.length === questions.length ? renderResult() : renderQuestion();
    }));
    box.querySelector('[data-back]')?.addEventListener('click', () => { answers.pop(); renderQuestion(); });
    if (moveFocus) box.querySelector<HTMLButtonElement>('.opt')?.focus({ preventScroll: true });
  }

  function renderResult() {
    const score = Math.round((answers.reduce((s, v) => s + v, 0) / (questions.length * 4)) * 100);
    const r = results.find(x => score <= x.max)!;
    box.innerHTML = `
      <div class="result" tabindex="-1">
        <div class="count">${ui.yourScore}</div>
        <div class="score">${score}<span style="font-size:24px;color:var(--muted)">/100</span></div>
        <h2>${r.title}</h2>
        <p>${r.text}</p>
        <h3>${ui.start}</h3>
        <ul class="ticks">${r.recs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="btnrow">
          <a class="btn btn-primary" href="${ROUTES.contact[lang]}?topic=audit&amp;score=${score}">${ui.cta}</a>
          <button type="button" class="btn btn-ghost" data-restart>${ui.restart}</button>
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
