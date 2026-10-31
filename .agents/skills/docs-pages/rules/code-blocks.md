---
title: Code Blocks
impact: HIGH
tags: [code, copy, tabs, highlights, walkthrough, install]
---

# Code Blocks

In developer docs the reader looks at the code first and reads the prose only when the code isn't
enough. A code block has to say what file it is, be copyable in one click, show what changed, and fit
the reader's setup without making them translate it.

## Why

- **"Where does this go?" is the most common question a code block leaves open.** A title that names the
  file answers it before the reader asks.
- **Translation is friction.** A reader on Bun who sees only `npm install` has to stop and convert; a
  reader who picked Bun once should see Bun everywhere.

## Every block

- **A title bar naming the file** (`vite.config.ts`, `app/routes.ts`) with its icon, or "Terminal" for a
  shell, and the copy button on the right (Next.js, Tailwind, Cloudflare). Untitled blocks show the
  language, small and muted.
- **Copy** copies exactly what a reader should paste: no `$` prompt, no output lines. The icon becomes a
  check for ~2s and an `aria-live` span says "Copied".
- **Highlight the lines that matter.** When a step changes a file, show the file and mark the changed
  lines: Tailwind runs the tint across the full block width with a 2px accent bar and compensates the
  padding so text doesn't shift; Cloudflare shows the "Original index.js" and then `index.js` with its
  changed line marked. Diffs (`+`/`-`) only when removals matter.
- **Line numbers** only on long reference listings that prose refers to by line.
- **Scrolls inside its box** at 375, never wraps code mid-token, never pushes the page sideways.
- Dark-on-dark or light-on-light: the block is one step off the page background in both themes, with a
  hairline border; syntax colours pass 4.5:1 in both.

## Tabs that mirror a choice

- Package manager (npm / pnpm / yarn / bun), framework, OS, language: tabs with a shared key. Choosing
  one switches every group with that key on the page and persists across pages (Starlight `syncKey` and
  Fumadocs in localStorage, shadcn in `localStorage.config`, sdxc.dev in a cookie so the server renders
  the reader's choice with no flash). Next.js doesn't sync; it's the weakest part of its code.
- The chosen tab's indicator slides; the panel keeps one height so the page doesn't jump.
- Switching the language renames the file in the title (`page.tsx` ↔ `page.js`, Next.js).

## Walkthroughs

For a quickstart that builds one file across steps, put the steps beside the code (Tailwind's numbered
steps next to dark panels at wide widths). Stripe's quickstart is the bar: a sticky code pane beside the
steps that, as each step scrolls into view, switches to the step's file, highlights its lines over 200ms
and scrolls them into view, while the step itself gets a 4px accent border. Stack them on phones.

## Choosers that rewrite the page

When the integration path changes the whole page (Stripe's Checkout / Elements / Mobile, Next.js' App
Router / Pages Router), put the choice in the URL so it can be shared, remember it, and remove the
unchosen variant from the DOM: Stripe keeps the hidden copy with the same heading ids, so hash links land
on invisible headings.

## Rules

1. Title every block with its file, and copy without prompts.
2. Mark the changed lines when a step edits a file.
3. Sync and persist mirrored tabs; keep the panel height fixed.
4. For a multi-step build, keep the code beside the steps and follow the reader.
