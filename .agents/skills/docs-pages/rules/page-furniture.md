---
title: Page Furniture
impact: MEDIUM
tags: [breadcrumbs, page-actions, markdown, llms, feedback, last-updated, 404]
---

# Page Furniture

Around the content sit the small things that say the docs are maintained and meet the reader where they
work: a breadcrumb, a copy-as-Markdown action, a last-updated date, a feedback prompt, a useful 404.
Each is quiet; together they are the difference between a living site and an export.

## Why

- **Readers increasingly read docs through an AI tool.** Copy as Markdown, View as Markdown, Open in
  Claude/ChatGPT and `llms.txt` are now standard (Stripe, Next.js, Cloudflare, Fumadocs, shadcn, Bun).
- **Dates and edit links are trust signals.** "Last updated Oct 12, 2026" says someone is looking.

## The title row

- Breadcrumb above the title, small and muted, the last crumb plain text (Stripe, Next.js, Cloudflare).
- One quiet actions row under the title, or a split button beside it:
  - **Copy page** (primary half): copies the page as Markdown; the label becomes "Copied" for ~2s.
  - **Menu**: View as Markdown, Open in Claude, Open in ChatGPT, and for developer docs an MCP URL or
    "Add to Claude Code". Each item says what it does (Bun).
- Cloudflare puts "Last updated · Copy as Markdown · View as Markdown" in one muted meta row; that's
  the right weight. A row of loud buttons above the first paragraph is not.

## The foot of the page

In this order (see @rules/where-next.md): next steps → **"Was this helpful?"** (👍/👎 at body size, a
textarea and up to three reasons after a choice, then a thank-you; Stripe's 36px headline is too loud)
→ **Last updated** and **Edit this page** → pager → support links on product docs.

## Machine-readable

- Every page has a `.md` twin at a predictable URL, linked from the page actions.
- `/llms.txt` lists the docs; `/llms-full.txt` concatenates them for small sites.

## 404

A docs 404 is a search box, not an apology: the missing path, a search field pre-filled with its last
segment, the hub's start-here links, and the sidebar still present so the reader can navigate on.

## Rules

1. Breadcrumb, title, description, then one muted actions row.
2. Offer the page as Markdown and in an AI chat; publish `llms.txt`.
3. Close every page with feedback, the date and the edit link, quietly, in a compact `DocsFooter`
   beside the sidebar; the full marketing footer stays on landing pages.
4. Make the 404 a search.
