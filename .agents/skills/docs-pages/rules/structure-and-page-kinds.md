---
title: Structure and Page Kinds
impact: CRITICAL
tags: [information-architecture, sidebar, hub, diataxis, page-kinds]
---

# Structure and Page Kinds

A docs site is navigated before it is read. A reader decides in seconds whether the answer is here, from
the sidebar's shape, the hub's routes and the page title. Get the structure right and an average page
still works; get it wrong and a perfect page is never found.

## Why

- **Readers arrive with a job, not a curiosity.** "Install it", "Make the login check run every 15
  minutes", "What does `maxAge` default to". Each job wants a different kind of page.
- **Mixing kinds is the most common reason a page feels long.** A tutorial that stops to list every
  option, or a reference that teaches, serves neither reader.

## Four kinds of page, kept apart

| Kind | Reader's question | Shape | Title |
| --- | --- | --- | --- |
| Tutorial / quickstart | "Get me to something working" | Numbered steps, one path, a visible result at the end | "Quickstart", "Build your first …" |
| How-to / guide | "How do I do X?" | Short intro, steps or sections, the one way that works | A task: "Send a test alert", "Create a database" |
| Reference | "What exactly does X do?" | Tables, signatures, defaults, every option, no story | The thing's name: "`createCookie`", "HTTP monitor fields" |
| Concept / explanation | "Why does it work this way?" | Prose, diagrams, trade-offs | A noun phrase: "How checks run", "Sessions" |

A page is one kind. When a guide needs the full option list, it links to the reference. When a reference
needs a story, it links to the guide.

## The sidebar

- **Group by what the reader is doing**, in the order they'll do it: Get started → Guides by area →
  Reference → Help. Groups are labelled in small caps or muted text; links are the readable size.
- **Two levels, three at most.** Fumadocs, Starlight and Cloudflare all collapse deeper trees behind a
  chevron; a reader scanning 200 flat links finds nothing.
- **Mark the current page unmistakably** (filled pill, accent bar, or bold accent text) and keep the
  sidebar's scroll position when moving between pages.
- **Titles are short and parallel**: "Installation", "Configuration", "Deploying", not a mix of nouns,
  questions and sentences.
- **Pin help at the foot** on product docs: "Contact support", "Status", "Community" (Linear, Notion).
- **Big sites split the tree with tabs** above it (Bun: Runtime / Package manager / Bundler; Stripe:
  Payments / Revenue / …) or a product switcher (Fumadocs, Cloudflare). A small site doesn't need them.

## The hub

The first docs page routes, it doesn't explain. It answers "where do I start?" for a newcomer and
"where is X?" for someone returning:

- **Start here**: one or two cards to the quickstart and the main concept, larger than the rest.
- **By task or area**: the sections as cards with one line each, or grouped link lists.
- **Search** prominent, because a returning reader wants it first.
- Optional for product docs: popular articles, and the support route.

A hub that is a wall of 100 links (or a long essay) makes the reader do the routing.

## Page anatomy

Every page has the same skeleton, so the reader learns it once:

1. Breadcrumb (section › page), small and muted.
2. Title (one `h1`) and a one-sentence description that says what the page gets you.
3. Page actions row: copy as Markdown / open in an AI chat / last updated, quiet and small.
4. Content in `h2` sections that each answer one question.
5. Where next: a curated "Next steps", then feedback, then the prev/next pager.

## Rules

1. Decide each page's kind before writing it; split a page that is two kinds.
2. Order sidebar groups by the reader's journey, two levels deep, current page clearly marked.
3. Make the hub route by task, with the quickstart first and search prominent.
4. Give every page the same skeleton, so position alone tells the reader where things are.
