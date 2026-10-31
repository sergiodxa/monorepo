---
title: Product Docs for Non-Developers
impact: HIGH
tags: [product-docs, help-centre, troubleshooting, screenshots, plans, support]
---

# Product Docs for Non-Developers

Help-centre docs (Uptime's, a reader app's) serve someone who is stuck inside the product and wants to be
unstuck in under a minute. They don't want concepts or code; they want the screen, the button, the path
to it, and what to do when it still doesn't work. The reference is Notion's Help Center, Linear's docs and
Readwise Reader's docs (`docs-shots/notion-*`, `linear-*`, `readwise-*`).

## Why

- **The reader arrives with a symptom or a task in their own words.** "I can't log in", "Import from
  Pocket". Pages, headings and search have to meet those words.
- **Every unanswered question becomes a support ticket**, so the page's last job is the route to a person.

## Two kinds of page, named in the reader's words

- **Task pages**: verb + object. "Add a monitor", "Set up SMS alerts", "Subscribe to a newsletter".
- **Symptom pages**, first person: "I'm getting alerts but my site is up", "My feed stopped updating".
  Group them behind a "Fix a problem" door at the top level of the sidebar and the hub (Notion).

## The page shape

1. Title in the reader's words, and one line under it saying what the page gets them ("In this help
   doc", Notion).
2. **Plan and role notice** directly under it when gated, the same sentence every time, plan names
   linked to pricing: "Available on the Team and Business plans." (Linear repeats this exact box.)
3. Numbered steps, each naming the UI precisely and showing it.
4. A FAQ accordion of the reader's actual questions.
5. "Still stuck? Contact us", then one curated "Up next" card.

Symptom pages: link the status page first, then one `h2` per cause ("If you use a firewall…"), then the
edge case, then contact, then two or three sibling symptoms.

## Name the UI, don't describe it

- A **UI label chip** for every button or menu the reader must find: sans (not monospace), light fill,
  hairline border, ~5px radius, `white-space: nowrap`. Paths join chips with →:
  `Settings` → `Notifications` → `Add channel` (Notion's best move; Linear's bold text is weaker, and
  monospace reads as code).
- **Keys as `kbd` chips**, one per key: <kbd>⌘</kbd> <kbd>K</kbd>.

## Show the real screen

- Crop to the region that matters, so it still reads at 375; a full-window screenshot shrinks to noise
  on a phone (all three references fail this).
- Prefer a clean redraw of the product's own UI (Linear) or a short muted clip without controls that
  plays once on scroll and stays still under `prefers-reduced-motion` (Notion).
- Arrows and annotations only on third-party UI (a DNS provider, a mail filter, a browser setting).
- Dark-mode variants, or a frame that sits on both themes.

## Search and the hub

- The hub opens on a question: "How can we help?", a search field, four topic chips, a "Where should I
  start?" list of the first five tasks, and popular articles with a picture of the UI.
- Search forgives questions: ignore "how do I / can I / why is", match synonyms ("check" = "monitor",
  "RSS" = "feed"), label results by kind (Guide / Troubleshooting / FAQ), and make no results useful:
  popular articles and a contact link. Linear shows nothing at all on no results; don't.

## Support is always one click away

Pinned "Contact support" at the sidebar foot (Linear), a warm end-of-page "Questions?" block (Readwise),
and a modest "Was this helpful?". Keep the "On this page" disclosure on phones, which all three drop.

## Rules

1. Title task pages verb + object and symptom pages in the first person; give symptoms their own door.
2. State plan and role under the title, in one fixed sentence.
3. Name every control with a UI chip and a → path; keys as `kbd`.
4. Show cropped, real UI that reads at 375; annotate only other companies' screens.
5. End every page with a route to a person and one curated next page.
