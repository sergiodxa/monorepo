---
title: Study the References
impact: HIGH
tags: [taste, references, examples, review]
---

# Study the References

These sites were studied in October 2026 at 1440 and 375, in light and dark, by searching, scrolling,
copying and following their pagers. Each entry names the moment that works and why, so you can copy the
move, and the weak spots, which are the cheapest lessons. Screenshots and full notes live in the docs
round's notes folder (`docs-shots/`, `docs-research/*.md`); open the live page for anything you build.

## Developer docs

**Fumadocs** (fumadocs.dev/docs) — the most finished open-source shell.
- The TOC band: one tinted gradient behind *every* heading in view, moved with `clip-path` over 300ms
  ease-out, growing in whole 28px rows. The reader sees how much of the page is on screen.
- Phone TOC: a 40px bar with an 18px progress ring and the current section rolling in with a slight blur.
- Search: 640px dialog, results grouped by page with heading hits on a hairline rail, scope filter.
- Foot: Good/Bad feedback that opens a textarea, "Last updated", then prev/next cards.
- Weak: no empty state in search, 1.5–2.5s latency with no loading row.

**shadcn/ui** (ui.shadcn.com/docs) — the best routing.
- Installation offers three starting-point cards, then a framework logo grid: the reader picks their
  situation and every next page fits it.
- Component pages: a framed live preview with a faded three-line code peek and "View code" in place.
- Package-manager choice persists site-wide and even feeds the search footer's copy command.
- Weak: TOC marks by bold only and never reaches the last section; search shows raw `<mark>`/backticks;
  no search or TOC on phones; the previous arrow wraps into another library.

**Stripe** (docs.stripe.com) — the best code walkthrough.
- The quickstart's sticky code pane follows the steps: switches file, highlights the step's lines, scrolls.
- An integration chooser in the URL and a cookie rewrites the body and the TOC.
- Optional steps collapsed, labelled "Optional" in the heading and the TOC, with Server-side badges.
- "Not a developer?" routes non-developers away before the chooser.
- Weak: hidden chooser variants keep duplicate heading ids; the feedback headline is 36px.

**Cloudflare Workers** (developers.cloudflare.com/workers) — the best TOC and procedure pages.
- The TOC rail is one SVG path curving into the `h3` indents; the marker slides along it (300ms,
  `cubic-bezier(.32,.72,0,1)`), fades under reduced motion, and marks the last item.
- Numbered `h2` steps, so the TOC is the checklist; troubleshooting in `<details>` right after its step.
- "Original index.js" then the edited file with its changed line marked.
- A muted meta row under the title: Last updated · Copy as Markdown · View as Markdown.
- Weak: semantic search answers nonsense confidently, with no match highlighting.

**Bun** (bun.com/docs) — the best search.
- Opens on `/`; API symbols first with a kind label; scopes switched with Tab; an empty scope points to
  the scopes that have hits; matches in an 18% accent tint; three example queries before typing.
- "Copy page" menu items each say what they do (Open in Claude, MCP URL, Add to Claude Code).
- Callouts at the right weight: 6% tint, 30% border.
- Weak: no TOC on phones, a nearly invisible active marker, tab sync lost on reload.

**Tailwind CSS** (tailwindcss.com/docs) — the best-looking steps.
- `[01]` bracketed numbers beside framed dark panels; full-width line highlights with a 2px bar.
- Utility tables cut to ~10 rows with a fade and "Show more"; live examples hatch the property itself.
- Weak: no TOC on phones or between 1024 and 1279px; no motion on the marker.

**Next.js** (nextjs.org/docs) — the best switchers.
- App/Pages Router and version switchers keep your place in the URL; code titles carry file icons and
  rename between TS and JS; "Copy page" items each have a one-line description; feedback is four emojis
  and an optional note.
- Weak: tabs don't sync; search has no empty state, highlighting or "no results".

**Starlight** (starlight.astro.build) — the content components to copy.
- Steps (28px counter, 1px rail stopping 6px short), file tree (native `<details>`, accent pill for the
  file in question, muted comments), synced tabs (`syncKey`), four asides, link cards.
- Weak: search without arrow keys or empty state; TOC misses the last section.

## Product docs

**Notion Help Center**, **Linear docs**, **Readwise Reader docs** — see @rules/product-docs.md.
- Notion names every button with a sans UI chip and joins paths with →; first-person "Fix a problem"
  pages start with the status page.
- Linear redraws its own UI as clean panels, repeats one plan sentence on gated pages, and pins "Contact
  support" at the sidebar foot.
- Readwise organises pages as the user's own questions and ends each with a warm "Questions?" panel.
- Weak, all three: questions in search fail or return nothing; screenshots shrink to noise at 375; no
  TOC on phones.

## Our own sites (the gaps)

sdxc.dev has the better parts (⌘K with scoped tabs, persisted install tabs, page actions, Markdown twins,
"Where to go next") in a weaker shell; Uptime has the tidier shell and almost nothing for finding things
(title filter only, no ⌘K, raw JSON Schema in the API pages, `h2` louder than `h1`). Both: the TOC marker
falls out of the rail on long pages, the sidebar never shows the current page, no heading anchors, no
feedback, 404s without search.

## Rules

1. Open the reference for the piece you're building, and copy the move, not the content.
2. Treat every weak spot above as a check for your own page.
