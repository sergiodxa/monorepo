---
title: Copy with Taste
impact: HIGH
tags: [taste, copy, headlines, voice]
---

# Copy with Taste

Landing copy is short, concrete and confident. The headline promises an outcome, the lead says how, every
card title is a claim, and every number is real. Write the story before any markup, then cut until each
line earns its place.

## Why

- **Specific copy sounds true.** "Finance closes without asking engineering" is believable;
  "streamline your billing workflow" is noise readers have learned to skip.
- **Copy and visuals are one argument.** When the card title is a claim, the scene above it proves it;
  when the title is a noun ("Alerts"), the scene has nothing to prove.

## Pattern

```text
Bad:   The most powerful usage-based billing platform
Good:  Turn API usage into paid invoices

Bad:   Keel is a robust, scalable, seamless solution for modern teams.
Good:  Keel meters every event your product emits, prices it on any plan you can describe
       and sends the invoice on the first of the month, so finance closes without asking engineering.
```

The same product can write both. These are from Uptime, whose home and feature pages use generic
titles while `/browser-flows` writes its own:

```text
Weak (feature pages, home)                    Strong (/browser-flows)
Deep Dive / Everything you need               Examples / Three click-throughs teams run on a schedule
Get started / How it works                    How it works / From a verified domain to a named failure
Pricing / Simple, transparent pricing         Pricing / Priced per run, not per click
Start monitoring your services                Catch the break your visitors would hit
```

The strong column names what this page's reader gets, so it could not appear on another page. When a
family of pages shares a template, give every record its own band titles instead of one shared key.

Open on the reader's problem when the product is a fix for one:

```text
Weak:  Monitor your services with confidence
Strong: A 200 on the homepage still hides a broken login.
```

## Write the story first

Before any JSX: the promise (the `h1`, 6–10 words), the lead (who it is for and the outcome, one
`<strong>` phrase), three to six proofs (each becomes a band with its own visual), the one action and its
secondary, and the objections a reader has (the FAQ, two or three sentences each). @rules/worked-example.md
shows one written out.

Test each line by swapping the product name: if a competitor could print the sentence unchanged, it says
nothing yet.

## Voice

- **Outcomes over features.** Say what changes for the reader, then how.
- **Verbs and nouns, not adjectives.** Cut "powerful", "seamless", "robust", "next-gen", "cutting-edge",
  "effortless", "world-class".
- **Numbers from the product.** "Every 30 seconds from 9 regions", read from config.
- **Sentence case** for every title; never Title Case.
- **Short.** Chapter titles 32 characters or fewer; card descriptions one or two sentences; CTA labels two
  or three words that fit on one line at 320px.
- **Eyebrows locate, titles claim.** "01 / Metering" or "Status pages" above, the claim below. An eyebrow
  that repeats the title ("Uptime vs UptimeRobot" over "Uptime vs UptimeRobot") wastes both; make the `h1`
  the argument ("Pay for checks, not monitor slots").
- **Checks are guarantees.** "Idempotency keys drop retried events" — concrete, testable, three of them.
- **Honest about limits.** Comparison pages that admit where the competitor wins read as more trustworthy.
- **Never narrate the page or the API** ("In this section…", "Use our endpoint to…").

## Rules

1. Write promise, lead, proofs, action and objections before building.
2. Headline the outcome; let the lead say how, with one `<strong>`.
3. Make card titles claims the scene above them proves.
4. Cut adjectives; use real numbers read from the product.
5. Keep titles short and in sentence case.
