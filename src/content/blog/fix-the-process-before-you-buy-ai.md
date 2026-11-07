---
title: "Fix the process before you buy the AI"
seoTitle: "Fix the process before you buy the AI | DNA4Digital"
description: "AI pilots stall on broken handoffs and unwritten rules. Six questions to ask before you automate a step, and the order of work that makes AI pay back."
excerpt: "Most AI pilots stall in the gaps between teams. Six questions to ask before you automate a step, and the order I work in."
slug: "fix-the-process-before-you-buy-ai"
lang: "en"
translationKey: "blog-01-fix-the-process"
alternate: "/pl/blog/napraw-proces-zanim-kupisz-ai/"
pubDate: "2026-11-07"
author: "Daniel Nowak"
tags: ["AI adoption", "Process design", "Automation", "Lean Six Sigma"]
readingTime: 5
heroImage: "/images/blog/fix-the-process/hero.webp"
heroAlt: "Several tangled grey lines on the left converge into one straight line with seven evenly spaced points, the last one highlighted in teal."
ogImage: "/images/blog/fix-the-process/og-en.png"
ogAlt: "Fix the process before you buy the AI. Daniel Nowak, dna4digital.com"
---

In a hotel restaurant you find out about a broken process within the hour. A table has waited forty minutes for mains and the kitchen says the order never came through. A few minutes later the waiter and the chef are standing at the pass, tracing the order from the table to the printer, and nobody suggests buying a new till.

I spent thirteen years in hotels and restaurants in Poland and Ireland before I moved into tech. I kept one habit from that time: when work stalls, I check how people hand it to each other before I look at the tools.

Office work hides the same failure for longer. A broken handoff in a CRM or a support queue leaves you with a backlog that grows by a few tickets a day, and in time with a meeting where someone proposes an AI tool as the fix.

## The numbers point at the process

In 2025 MIT's NANDA initiative published *The GenAI Divide: State of AI in Business 2025*. Among other sources, the authors interviewed 150 business leaders and analysed 300 public AI deployments. Its most quoted finding: about 95% of the enterprise generative AI pilots it looked at showed no measurable impact on profit and loss. They traced the problem to how companies fitted the tools into their workflows and to what they called a learning gap, rather than to the quality of the models.

McKinsey's survey *The state of AI in 2026*, published in August, looks at the same question from the other end. Thirty-seven percent of respondents attribute at least some EBIT impact to AI. The group McKinsey calls high performers, those who attribute at least 5% of EBIT to AI and describe its impact as significant, makes up 6% of respondents. Nearly three quarters of those high performers say they fundamentally redesigned workflows because of their AI use. Among the other respondents, about one in four did.

A survey can't prove that the redesign caused the return. The gap between three quarters and one quarter still tells me where to look first.

Michael Hammer made a sharper version of this argument in *Harvard Business Review* in 1990, in an article titled "Reengineering Work: Don't Automate, Obliterate". His target was companies that bought computers to push old paperwork through faster. The tools have changed since then, and the mistake looks the same.

## Automation copies what it finds

An AI tool learns from the work your team already does. If three people answer the same customer question in three different ways, the tool learns every version, the wrong ones included. If the same customer sits in two systems under two spellings, the model reads both records and you get two answers faster than before.

Time behaves the same way. In most service processes the hands-on work takes a small share of the elapsed time, and the rest is waiting in queues and for approvals. Speed up a step that takes ten minutes, and a ticket that waits two days in a queue still waits two days.

<figure>
  <picture>
    <source media="(max-width: 640px)" srcset="/images/blog/fix-the-process/fig-1-ticket-time-en-narrow.webp" width="900" height="1350">
    <img src="/images/blog/fix-the-process/fig-1-ticket-time-en-wide.webp" width="1600" height="900" loading="lazy" decoding="async" alt="Timeline of one support ticket. Hands-on work: logging 5 minutes, triage 10 minutes, resolution 25 minutes, closing 5 minutes, 45 minutes in total. Waiting: 1 day in the queue, 1.5 days for the second line, half a day for approval. End to end: 3 days 45 minutes. With AI triage cutting triage to 2 minutes, end to end becomes 3 days 37 minutes.">
  </picture>
  <figcaption>Illustrative example. Cutting triage from ten minutes to two saves eight minutes on a ticket that takes more than three days end to end. Hands-on work is about 1% of the elapsed time, counted in calendar days.</figcaption>
</figure>

## What process first looked like in a support team

When I was Client Operations Manager at a [restaurant-tech platform](/selected-work/), the right answer to a common issue depended on who picked up the ticket. We audited the workflow end to end and rebuilt the SOPs so the correct answer was written down and easy to find. Only after that did we automate the repetitive parts around the standard. Ticket handling time dropped by 30%.

An AI assistant trained on the old tickets would have learned every version of the answer. Writing the standard first gave the automation one correct version to work from.

## Six questions before you automate a step

I ask these about each step a client wants to automate. Answering them takes an afternoon, and the answers show whether the step is ready.

1. **Can two people describe the step the same way?** Ask two people who do the work to walk you through it separately. If their descriptions differ, you have two processes, and the automation will pick one of them without telling anyone.
2. **Who owns it?** Name the person who can change the step and who answers for its result. Tickets tend to wait at the steps nobody owns.
3. **Where do the exceptions go?** Count how often the standard path fails, then follow one exception to the end. Unwritten exception rules are the first thing an AI tool gets wrong.
4. **Is the input clean where it enters?** Check the data at the moment someone types it in, before it reaches a report. Duplicates and free-text fields travel downstream and multiply.
5. **Would a faster step change the end-to-end time?** If the step takes minutes and the queue in front of it takes days, fix the queue.
6. **Do you have a baseline?** Measure cycle time and cost per case before you change anything. Without a baseline, nobody can say later whether the AI paid back.

## The order I work in

Lean Six Sigma practitioners will recognise DMAIC in this sequence. I leave the vocabulary out of workshops and keep the order.

1. Walk the process with the people who do it.
2. Map the handoffs and the waiting time between them.
3. Measure a baseline.
4. Remove the steps that add nothing and simplify the rest.
5. Write the standard down where people will look for it.
6. Automate the repetitive parts and add AI where it sorts or drafts.
7. Measure again against the baseline.

<figure>
  <picture>
    <source media="(max-width: 640px)" srcset="/images/blog/fix-the-process/fig-2-sequence-en-narrow.webp" width="900" height="1350">
    <img src="/images/blog/fix-the-process/fig-2-sequence-en-wide.webp" width="1600" height="900" loading="lazy" decoding="async" alt="Seven steps in two phases. Fix the process: 1 walk the process with the people who do it, 2 map handoffs and waiting time, 3 measure a baseline, 4 remove and simplify, 5 write the standard down. Automate and prove it: 6 automate repetitive parts and add AI, 7 measure again against the baseline.">
  </picture>
  <figcaption>Seven steps in two phases. AI enters at step six.</figcaption>
</figure>

Steps one to five decide whether step six pays back. They give the automation a written standard to learn from and a baseline that shows what it changed.

## Where AI earns its place

Once the process holds, AI does well on work where a person can check the output in seconds: classifying incoming requests, drafting replies from the written standard, summarising long threads and pulling fields out of documents. Each of these depends on a standard someone has already written down.

At Sensay the same order applied to revenue data. We moved it from a legacy CRM and a set of disconnected tools into one HubSpot instance, and only then built automated sequences in n8n and Zapier. We built the Looker Studio dashboards on that data, and leadership started opening them because the numbers matched what the team saw on the ground.

Before a client signs an AI licence, I walk one process from start to finish with the people who run it and note every place where the work waits. That list decides which step we automate first.

<aside class="post-sources">

### Sources

- MIT NANDA, *The GenAI Divide: State of AI in Business 2025*, as reported by [Fortune, 18 August 2025](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/)
- McKinsey, [*The state of AI in 2026: On the road to ROI*](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai), 25 August 2026
- Michael Hammer, ["Reengineering Work: Don't Automate, Obliterate"](https://hbr.org/1990/07/reengineering-work-dont-automate-obliterate), *Harvard Business Review*, July 1990

</aside>
