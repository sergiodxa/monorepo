---
title: Honest Proof
impact: CRITICAL
tags: [proof, copy, figures, testimonials]
---

# Honest Proof

Proof is the reason a reader believes the promise, so it must be true. Never invent logos, customer names,
quotes, testimonials, ratings, press mentions or metrics. When a page has no real proof of a kind, leave
that section out instead of filling it with placeholders.

## Why

- **One fake undoes the page**: a reader who spots an invented logo discounts everything else.
- **Claims drift**: a hand-typed "60 packages" was wrong within weeks. A number read from its source
  cannot drift.
- **Prices are contracts**: copy that states a price of its own disagrees with checkout the day the price
  changes.

## Pattern

```md
<!-- Bad: typed by hand, wrong next month -->
# Six habits, kept for sixty packages

<!-- Good: counted from the registry at render time -->
# Six habits, kept for {% $packageCount %} packages
```

```tsx
// Bad: a word dressed as a statistic
<StatStrip.Item label="Setup">Fast</StatStrip.Item>

// Good: a figure from config
<StatStrip.Item label="Check interval">{formatSeconds(MIN_INTERVAL_SECONDS)}</StatStrip.Item>
```

```tsx
// Bad: a logo wall nobody agreed to
<LogoCloud label="Trusted by teams at">{FAKE_LOGOS}</LogoCloud>

// Good: no logo section at all; the hero proof is a CheckList of product facts
<CheckList orientation="horizontal">
	<CheckRow>No credit card</CheckRow>
	<CheckRow>Cancel anytime</CheckRow>
</CheckList>
```

## Where real figures come from

- **Counts**: compute them (`contentVariables()` in `apps/sdxc-site/app/services/article.ts` fills
  `{% $packageCount %}` and friends from the registry).
- **Prices and limits**: import them from the app's pricing config (`apps/uptime/config/pricing.ts`) and
  interpolate them into copy; Uptime's home test scans its source so no page states a price of its own.
- **Product limits**: state them exactly (Uptime's browser flows run at most every 15 minutes, and the copy
  and sample data respect that).
- **People**: a real author, real sponsors from the sponsor API, real GitHub data.

## What is fine

Sample data inside a drawn product mockup: `example.com` hosts, generic names, reserved IPs, plausible
invoice amounts. It reads as a screenshot of the product, not as a claim about customers. Demo landings for
invented products (sdxc.dev/demo/*) may invent their own proof, because the whole product is fictional and
the page is marked `noindex`.

## Rules

1. Never invent logos, customers, quotes, testimonials, ratings, press or metrics for a real product.
2. Read every figure and price from code or config; never type it into copy.
3. Delete word-valued "stats" ("Fast", "REST", "Auto"); show a `StatStrip` only when every value is a
   real figure.
4. Cut a proof section that has no real content; do not leave placeholders.
5. Keep sample data inside product mockups, using reserved hosts and generic names.
