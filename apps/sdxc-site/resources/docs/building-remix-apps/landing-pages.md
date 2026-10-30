---
title: Build a landing page
description: Assemble a marketing page from @sdxc/ui's landing patterns, give it your brand through tokens, and drop to the primitives when a band needs its own shape.
section:
    title: Building Remix apps
    order: 4
order: 10
lastUpdated: 2026-10-30
outcomes:
    - "How to stack a landing from hero, proof, feature, FAQ and closing bands"
    - "How to give the bands your brand through the marketing tokens"
    - "How to build a band of your own from the marketing primitives"
---

A landing page is a stack of full-width bands: a hero, a strip of proof, a few feature bands,
the questions people ask, and a closing call to action. [`@sdxc/ui`](/api/ui) ships each of
those as a pattern, plus the primitives they are built from, so a page is mostly choosing
bands and passing them copy. The library ships no copy of its own: every string on the page
is a prop or a child you pass.

```bash
npm add @sdxc/icons @sdxc/ui remix
```

The bands use the same stylesheets as every other `@sdxc/ui` component, imported once from the
document layout. [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
sets those up; this guide starts from a page that already renders `@sdxc/ui` components.

## Three layers

| Layer       | Import from         | What it gives you                                                                                                            |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Patterns    | `@sdxc/ui/patterns` | Whole bands: `LandingHero`, `ProofStrip`, `FeatureBand`, `FaqBand`, `ClosingCta`                                             |
| Primitives  | `@sdxc/ui`          | The parts bands are made of: `MarketingSection`, `MarketingHeader`, `Split`, `StatStrip`, `LogoCloud`, `Feature`, `CtaGroup` |
| Foundations | `@sdxc/ui/styles`   | Tokens and style factories: `marketingCtaChrome()`, `marketingBandTone()`, and the `--ui-marketing-*` variables              |

Reach for a pattern first. When none fits, build the band from primitives, as the last
section shows.

## Stack the page

The hero renders the page's `<h1>`. Every band after it goes inside one `HeadingScope`, which
moves their titles to `<h2>`, so the outline stays sequential with no level passed by hand.

```tsx {% title="resources/components/landing.tsx" %}
import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import { ClosingCta, LandingHero } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import { Faq } from "~/resources/components/landing/faq";
import { Features } from "~/resources/components/landing/features";
import { HeroShot } from "~/resources/components/landing/hero-shot";
import { Proof } from "~/resources/components/landing/proof";

export function Landing() {
	return () => (
		<main>
			<LandingHero
				tone="grid"
				eyebrow="Uptime monitoring"
				title="Know it is down before your users do"
				description="Checks from six regions, alerts that agree, and a status page your customers trust."
				actions={
					<>
						<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
							Start free
						</Button>
						<LinkButton
							href="/pricing"
							size="lg"
							color="neutral"
							variant="outline"
						>
							See pricing
						</LinkButton>
					</>
				}
				media={<HeroShot />}
			/>

			<HeadingScope>
				<Proof />
				<Features />
				<Faq />
				<ClosingCta
					title="Start watching your endpoints today"
					description="Five monitors free, forever."
					actions={
						<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
							Create an account
						</Button>
					}
				/>
			</HeadingScope>
		</main>
	);
}
```

Render `<Landing />` from the page's controller inside your document layout, like any other
page. Nothing on it hydrates: the FAQ is `<details>`, and tabbed bands switch with radio
inputs and CSS.

Here is that page, live. Switch between Desktop and Phone to see each band rearrange itself
for the width it has:

<frame src="/frames/guides/landing-pages/landing">
The assembled landing: a hero with a framed monitors screen, the proof band, three feature
bands, the questions, and the closing call to action.
</frame>

## The hero

`LandingHero` lays the eyebrow, title, lead and actions beside `media`. `mediaPlacement`
moves the media `"below"` the copy or behind it as a `"background"`, and `align="center"`
centers the copy, which suits a hero with no media. Frame a screenshot with `ProductFrame` so
it reads as the product rather than as a loose image:

```tsx {% title="resources/components/landing/hero-shot.tsx" %}
import { ProductFrame } from "@sdxc/ui/patterns";

export function HeroShot() {
	return () => (
		<ProductFrame lights title="Monitors" url="app.example.com">
			<img
				src="/images/monitors.png"
				alt="Monitors dashboard with six regions passing"
			/>
		</ProductFrame>
	);
}
```

`ProductFrame variant="device"` draws a phone instead, and `CodeStage` frames a command or a
code sample when the product is a tool.

## Proof

`ProofStrip` is the ruled band right after the hero. Give it a `LogoCloud`, a `StatStrip`, or
both:

```tsx {% title="resources/components/landing/proof.tsx" %}
import { LogoCloud, StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

export function Proof() {
	return () => (
		<ProofStrip>
			<LogoCloud muted>
				<img src="/logos/launchpad.svg" alt="Launchpad" />
				<img src="/logos/northwind.svg" alt="Northwind" />
				<img src="/logos/keystone.svg" alt="Keystone" />
			</LogoCloud>
			<StatStrip>
				<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
				<StatStrip.Item label="Probe regions">6</StatStrip.Item>
				<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
			</StatStrip>
		</ProofStrip>
	);
}
```

`LogoCloud` sizes every mark to one height and, with `muted`, to one tone, so no customer's
logo outshouts the others. `StatStrip` sets its columns from its own width, two at first
and up to five on a wide band.

<frame src="/frames/guides/landing-pages/proof">
The proof band: three muted adopter marks over three figures.
</frame>

## Feature bands

`FeatureBand` is the band a landing repeats. Its `layout` decides the body:

- `"split"` puts claims beside `media`. Children that are a `<ul>` render as checked claims.
- `"grid"` lays `Feature` cells in `columns` with hairlines between them.
- `"steps"` numbers `StepList.Item` children for a "how it works" band.

```tsx {% title="resources/components/landing/features.tsx" %}
import { BellRingIcon, GaugeIcon, GlobeIcon } from "@sdxc/icons";
import { Feature } from "@sdxc/ui";
import { FeatureBand, ProductFrame, StepList } from "@sdxc/ui/patterns";

export function Features() {
	return () => (
		<>
			<FeatureBand
				layout="split"
				eyebrow="Incidents"
				title="Every incident writes its own timeline"
				media={
					<ProductFrame lights title="Incident">
						<img src="/images/incident.png" alt="Incident timeline" />
					</ProductFrame>
				}
			>
				<ul>
					<li>Status changes posted as they happen</li>
					<li>Responders and acknowledgements recorded</li>
					<li>One link to share with customers</li>
				</ul>
			</FeatureBand>

			<FeatureBand
				layout="grid"
				tone="tinted"
				title="Built for on-call"
				columns={3}
			>
				<Feature>
					<Feature.Icon>
						<GlobeIcon />
					</Feature.Icon>
					<Feature.Title>Six probe regions</Feature.Title>
					<Feature.Description>
						Every check runs from three continents.
					</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<BellRingIcon />
					</Feature.Icon>
					<Feature.Title>Alerts that agree</Feature.Title>
					<Feature.Description>
						A page fires when two regions see it.
					</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<GaugeIcon />
					</Feature.Icon>
					<Feature.Title>Latency per region</Feature.Title>
					<Feature.Description>
						Response time, beyond up or down.
					</Feature.Description>
				</Feature>
			</FeatureBand>

			<FeatureBand layout="steps" title="Live in three steps">
				<StepList.Item title="Add a monitor">
					Paste the URL you want watched.
				</StepList.Item>
				<StepList.Item title="Pick who gets paged">
					Route alerts to a rotation.
				</StepList.Item>
				<StepList.Item title="Share the status page">
					Customers subscribe to it.
				</StepList.Item>
			</FeatureBand>
		</>
	);
}
```

Alternate `tone` between bands (`"plain"`, `"tinted"`, `"grid"`) so a reader can tell where
one ends and the next begins. Leave `"inverse"` for the closing band, which uses it by
default. `lean="media"` gives a split band's media the wider column.

<frame src="/frames/guides/landing-pages/features">
The three feature bands: checked claims beside an incident screen, a tinted grid of three
features, and three numbered steps.
</frame>

## Questions

`FaqBand` takes one `Accordion`, or two for a pair of columns that stack into one list on a
narrow screen:

```tsx {% title="resources/components/landing/faq.tsx" %}
import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/patterns";

const QUESTIONS = [
	["How often do checks run?", "Every thirty seconds on paid plans."],
	["Can I use my own domain?", "Yes, point a CNAME at your status page."],
	["Is there a free plan?", "Five monitors and one status page, no card required."],
] as const;

export function Faq() {
	return () => (
		<FaqBand title="Questions">
			<Accordion>
				{QUESTIONS.map(([question, answer]) => (
					<Accordion.Item key={question} name="faq">
						<Accordion.Trigger>
							{question}
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>{answer}</p>
						</Accordion.Content>
					</Accordion.Item>
				))}
			</Accordion>
		</FaqBand>
	);
}
```

A shared `name` makes the items exclusive, so opening one question closes the one before.

<frame src="/frames/guides/landing-pages/faq">
The questions band, with three questions that open one at a time.
</frame>

## Your brand

The bands read their measure, spacing, type and CTA shape from `--ui-marketing-*` variables
that `@sdxc/ui/theme.css` declares. Override them after the theme, in the same stylesheet as
your palette:

```css {% title="resources/css/marketing.css" %}
:root {
	--ui-marketing-measure: 76rem;
	--ui-marketing-cta-radius: 9999px;
	--ui-font-display: "Inter Display", var(--ui-font-sans);
}
```

That gives a wider column, pill-shaped calls to action, and a display face for headlines.
Colors stay on your palette's `brand` and `neutral` scales, so the landing and the app share
them. [Marketing foundations](/api/ui/marketing-foundations) lists every token.

## A band of your own

When no pattern fits, build the band from the primitives the patterns use. `MarketingSection`
paints the band and centers its column; `MarketingHeader` gives it a title; `Split`, `Bento`
or anything else fills it:

```tsx {% title="resources/components/landing/pricing-teaser.tsx" %}
import {
	CtaGroup,
	LinkButton,
	MarketingHeader,
	MarketingSection,
	Split,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import { CheckList, CheckRow, CodeStage } from "@sdxc/ui/patterns";

export function PricingTeaser() {
	return () => (
		<MarketingSection tone="tinted" ruled mix={[viewReveal()]}>
			<MarketingHeader
				eyebrow="Pricing"
				description="One price per monitor, billed monthly."
			>
				Pay for what you watch
			</MarketingHeader>
			<Split lean="copy">
				<Split.Copy>
					<CheckList>
						<CheckRow>Free for five monitors</CheckRow>
						<CheckRow>No card required</CheckRow>
					</CheckList>
					<CtaGroup>
						<LinkButton href="/pricing" color="brand">
							Compare plans
						</LinkButton>
					</CtaGroup>
				</Split.Copy>
				<Split.Media>
					<CodeStage variant="terminal" title="~">
						$ beacon monitors add https://api.example.com
					</CodeStage>
				</Split.Media>
			</Split>
		</MarketingSection>
	);
}
```

`viewReveal()` from `@sdxc/ui/animations` brings a band in as it scrolls into view, and drops
the movement for a visitor who asks for reduced motion. It works on any band, patterns included,
through their `mix` prop.

<frame src="/frames/guides/landing-pages/pricing-teaser">
The pricing band: a tinted section with two checked claims and a link beside a terminal.
</frame>

## Test the outline

The page renders on the server, so a test renders it to a string and reads the headings.
It holds the outline to one `<h1>`, first, with every heading after it at most one level
deeper than the one before, which is what the single `HeadingScope` buys:

```tsx {% title="resources/components/landing.test.tsx" %}
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

import { Landing } from "~/resources/components/landing";

test("opens with one h1 and never skips a heading level", async () => {
	let html = await renderToString(<Landing />);
	let levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));

	expect(levels[0]).toBe(1);
	expect(levels.filter((level) => level === 1)).toHaveLength(1);
	for (let [index, level] of levels.slice(1).entries()) {
		expect(level).toBeLessThanOrEqual((levels[index] ?? 1) + 1);
	}
});
```

## Where to go next

- [Landing patterns](/api/ui/landing-patterns) — every pattern assembled into one page.
- The Marketing group in the [`@sdxc/ui`](/api/ui) catalogue — a live demo and the full props
  of each band and primitive.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — replace the literal
  copy above with messages, since every string is already a prop.
