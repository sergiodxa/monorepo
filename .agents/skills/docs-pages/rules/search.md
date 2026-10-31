---
title: Search
impact: CRITICAL
tags: [search, command-palette, keyboard, no-results, phone]
---

# Search

A returning reader opens search before they look at the sidebar. Search is the docs site's front door,
and it is where the references differ most: Bun's is excellent, Fumadocs' is good, Linear's shows nothing
at all for a question it can't answer.

## Why

- **Readers type what they're stuck on**, in their words: "webhook", "how do I change the base route",
  "redirect after login". Title-only filtering misses most of these (Uptime's sidebar filter returns
  nothing for "webhook", though the Alerts page has a Webhook section).
- **The dialog is a moment the reader feels.** It opens in 200ms or it feels slow; it shows something
  useful before the first keystroke or it feels empty.

## The trigger

- A search field in the header (or at the top of the sidebar) that looks like an input, with the
  shortcut shown as `kbd` chips: `⌘ K`, and `/` as a second binding (Bun, Cloudflare, Stripe).
- On a phone, an icon button in the header that opens a full-screen sheet with the input focused.

## The dialog

- ~640px wide, top pinned around a third of the viewport (Fumadocs: `calc(50% - 250px)`), a dimmed and
  lightly blurred backdrop (Fumadocs: 20% dim, 4px blur), opening with a short scale-and-fade (Fumadocs:
  from 1.06 over 300ms). `Esc` closes it and focus returns to the trigger.
- **Before typing**, show where to go: recent searches, a few quick links, or example queries (Bun offers
  three). A blank box wastes the moment the reader is most open to guidance.
- **Results grouped by page**, each with its section breadcrumb; heading hits indented under their page
  on a hairline rail with a `#` glyph (Fumadocs). Content hits show the matching sentence.
- **Match highlighting that reads**: a tinted background on the matched characters (Bun: 18% of the
  accent), never overlapping the next glyph, never raw `<mark>` or backticks in the text (shadcn's bug).
- **Kinds as scopes**: All / Guides / Reference / API, switchable with Tab, with counts (Bun, sdxc.dev).
  API symbols rank first for an exact name, labelled by kind (FUNCTION · INTERFACE).
- **Keyboard**: ↑ ↓ moves, Enter opens, ⌘Enter opens in a new tab, the footer shows these keys.
- **No results is a page, not a void**: say so, suggest the other scopes that do have hits (Bun), offer
  popular pages and a contact link (product docs).
- **Latency**: a loading row if results take over ~150ms; local indexes for small sites.
- A `/search?q=` page as the no-JavaScript fallback, which the dialog's form submits to.

## Product docs

Forgive questions: drop "how do I / can I / why is" before matching, match synonyms ("check" =
"monitor", "RSS" = "feed"), and title FAQ headings as questions so they match. See
@rules/product-docs.md.

## Rules

1. Show the shortcut on the trigger; bind both ⌘K and `/`.
2. Fill the empty state with somewhere to go.
3. Group by page with breadcrumbs, highlight matches cleanly, scope by kind.
4. Make no results useful: other scopes, popular pages, a human.
5. Keep a `/search` page working without JavaScript.
