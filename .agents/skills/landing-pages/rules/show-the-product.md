---
title: Show the Product
impact: CRITICAL
tags: [taste, mockups, scenes, sample-data, visuals]
---

# Show the Product

The strongest thing a landing can do is let the reader see the product working. Every claim gets a
picture of the product making it true: the dashboard with real-looking monitors, the alert arriving and
the recovery after it, the invoice line that traces back to its events. Draw that UI inline, as live markup
with the product's own labels, instead of placing a screenshot or describing it in a paragraph.

## Why

- **Seeing beats reading.** A reader believes "alerts when you go down" the moment they see the alert,
  with a real-looking host and a timestamp. The paragraph saying it is skimmed.
- **Inline UI stays true.** It uses the product's components, translations and theme, follows dark mode,
  scales to any width, and never drifts from the product the way a PNG does.
- **It is what separates a product page from a template.** A page of icons and adjectives could sell
  anything; a page of the product at work can only sell this one.

## A scene is one moment, not a screen

The best visuals capture one moment that proves the card's title, not a whole screen shrunk down. Before
drawing, finish the sentence "this shows the moment when…":

| Claim | The moment shown | Where |
| --- | --- | --- |
| Alerts you can trust | the outage alert, then its recovery under it | Uptime `AlertsScene` |
| Certificate monitoring | certificates counting down, one turning amber | Uptime `SslScene` |
| Status pages | three services with a month of daily bars | Uptime `StatusPageScene` |
| Global pricing | one price in four currencies, tabular figures | Keel `CurrencyScene` |
| Tax handled | jurisdiction rates as chips, the way an invoice picks them | Keel `TaxScene` |
| Webhooks | a delivery log: event, status, latency, aligned in a subgrid | Keel `WebhookScene` |
| Revenue recognition | recognised revenue climbing as deferred revenue drains | Keel `RecognitionScene` |
| Scan to restock | the camera framing a barcode, the item already on the list | Rooftree `ScanScene` |
| Add by voice | the words as heard, and the two rows they became | Rooftree `VoiceScene` |

Files: `apps/uptime/resources/components/marketing/{product-scenes,capability-scenes}.tsx`,
`apps/sdxc-site/resources/views/demos/saas/bento-media.tsx`, `apps/sdxc-site/resources/views/demos/app/bento-scenes.tsx`.

A moment has a before and after, a status change, or a cause and its effect. "A list of settings" is not a
moment; "the setting flipped and the chart reacted" is.

### Weak and strong scenes for the same claim

| Claim | Weak scene | Strong scene |
| --- | --- | --- |
| Certificate monitoring, "how it works" | the generic monitor screen: uptime bars and a latency chart (what `/features/ssl` shows today) | one certificate counting down past the 14-day warning, the alert it sent, and "Renewed · 90 days" after |
| Webhooks | a webhook icon on a card | Keel's delivery log: `invoice.finalized 200 84 ms`, four deliveries aligned in one subgrid |
| Works offline | a cloud with a slash through it | Rooftree's list with two ticks greyed and "Offline · 2 to sync" |
| Runs anywhere | four runtime logos | the same handler in four tabs where only the last lines change |

The weak column is what you reach for first, because it illustrates the noun. The strong column shows the
claim happening. If your scene would still make sense with the card title deleted, it is decoration.

### A text-only band and its visual version

```tsx
// Weak: four icon cards, one sentence each, mostly empty at 1280
<Feature.Grid columns={2}>
	<Feature>
		<Feature.Icon><ClockIcon aria-hidden="true" /></Feature.Icon>
		<Feature.Title>Expiry tracking</Feature.Title>
		<Feature.Description>Store your certificate's expiry date and issuer.</Feature.Description>
	</Feature>
	{/* … three more like it */}
</Feature.Grid>

// Strong: the facts become a list beside one scene that shows them working together
<FeatureBand layout="split" lean="media" title="Know a month before it expires" media={<CertificateCountdown />}>
	<ul>
		<li>Issuer and expiry read on every check</li>
		<li>Warnings at the thresholds you choose</li>
		<li>Repeats until you renew</li>
	</ul>
</FeatureBand>
```

## Realism

- **Specific data**: `api.example.com · 182 ms`, `€49.00 / EUR`, `Oct 28`, `TLS expires in 9 days`. Round
  numbers and "Lorem" read as fake; specific, slightly irregular values read as a real account.
- **The product at work, not empty**: a dashboard mid-month with history, a list half ticked off. Never an
  empty state or a single row.
- **The product's own words**: use its i18n keys and components (`Badge`, `Sparkline`) so the mockup looks
  like the product, not like a drawing of it.
- **One world per page**: share sample data across the hero, the cards and the spotlight
  (`apps/uptime/resources/components/marketing/product-mockups/sample-data.ts`). The same three hosts
  appearing everywhere makes the page feel like one account you are looking into.
- **Safe data**: `example.com` hosts, reserved IPs, generic names. It must read as a screenshot, never as a
  customer claim.
- **True to the product's limits**: if flows run at most every 15 minutes, the sample runs are 15 minutes
  apart.

## The hero is the product

The hero's media is the richest visual on the page: a full window of the product (`ProductFrame` with
traffic lights, a title, a URL) at least as tall as the copy beside it, dense with real-looking data. When
the product has several faces, let the reader switch between them (Keel's hero switches between the
revenue board, the meters and the API call). A one-line frame, a generic illustration or a "media goes
here" box fails.

```tsx
<ProductFrame lights title="Revenue" url="app.keel.dev">
	<RevenueBoard />
</ProductFrame>
```

## Mockups on phones

A product window keeps its desktop composition and scales down, or crops with a fade; it does not
reflow into a different layout that the product never shows.

```tsx
<ProductFrame lights title={title} url={url} designWidth="32rem" fit="scale" role="img" aria-label={label}>
	<div aria-hidden="true" data-slot="product-mockup">…</div>
</ProductFrame>
```

`apps/uptime/resources/components/marketing/product-mockups/parts.tsx` (`MockupWindow`) is the model. A hero
screen whose text must stay legible may reflow through container queries instead (Keel's
`revenue-board.tsx`), backed by a test that no label clips at 343px.

## Card scenes

A card scene is a cropped fragment, not a scaled screen: one fixed-height frame (18rem in Uptime's
`sceneFrame()`), the story at the top, the lower rows falling into the media fade so the scene suggests it
continues. Every card in a grid gets a scene, or none do.

Card and bento scenes are hidden below the `md` container, so on a phone the hero and the split bands
carry the whole visual story. Put the claim a phone reader must see in one of those, never only in a card.

## Never twice

The hero's visual appears nowhere else on the page, and no two bands show the same screen. When a page
family shares a template, keep per-slug choices in maps (`FEATURE_MOCKUPS`, a spotlight scene per audience)
and test that the spotlight never equals the hero.

## Rules

1. Show every claim as the product doing it; a text-only band is unfinished.
2. Draw each scene as one moment with a before and after, a status change, or a cause and effect.
3. Use specific, irregular, safe sample data, shared across the page.
4. Make the hero the richest visual: a full, dense product window, with a switcher if the product has
   several faces.
5. Scale or crop product windows on phones; never let them reflow into a layout the product lacks.
6. Never repeat a visual on one page.
