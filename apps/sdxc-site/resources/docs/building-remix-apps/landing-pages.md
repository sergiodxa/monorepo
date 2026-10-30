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
| Patterns    | `@sdxc/ui/patterns` | Whole bands: `LandingHero`, `ProofStrip`, `FeatureBand`, `PricingBand`, `TestimonialBand`, `FaqBand`, `ClosingCta`           |
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
				align="center"
				eyebrow="Status pages are here"
				eyebrowHref="/changelog"
				title="Know it is down before your users do"
				description={
					<>
						Checks from six regions, alerts that only fire when{" "}
						<strong>two regions agree</strong>, and a status page your
						customers trust.
					</>
				}
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Start free
						</Button>
						<LinkButton
							href="/pricing"
							variant="surface"
							mix={[marketingCtaChrome()]}
						>
							See pricing
						</LinkButton>
					</>
				}
				note="Five monitors free, no card required."
				media={<HeroShot />}
			/>

			<HeadingScope>
				<Proof />
				<Features />
				<Faq />
				<ClosingCta
					inset
					title="Start watching your endpoints today"
					description="Five monitors and a status page, free for as long as you need them."
					actions={
						<>
							<Button color="brand" mix={[marketingCtaChrome()]}>
								Create an account
							</Button>
							<LinkButton
								href="/contact"
								variant="surface"
								mix={[marketingCtaChrome()]}
							>
								Talk to us
							</LinkButton>
						</>
					}
				/>
			</HeadingScope>
		</main>
	);
}
```

Render `<Landing />` from the page's controller inside your document layout, like any other
page. Nothing on it hydrates: the FAQ is `<details>`, and tabbed bands switch with radio
inputs and CSS. Actions take the 40px marketing size from the `CtaGroup` the hero puts them
in, and `marketingCtaChrome()` gives both the brand's corner radius and a tactile edge; the
`surface` variant is a secondary that still reads as a button beside a solid primary.

Here is that page, live. Switch between Desktop and Phone to see each band rearrange itself
for the width it has:

<frame src="/frames/guides/landing-pages/landing">
The assembled landing: a centered hero over a staged status page, the proof band, three
feature bands, the questions, and an inset closing call to action.
</frame>

## The hero

`LandingHero` stacks the eyebrow, title, lead, actions and a `note` line in a set rhythm, then
places `media` under the copy at the full measure. That suits a text-led hero; for a
product-led one, where the media is taller than the copy, `mediaPlacement="end"` puts it
beside the copy and steps the headline down one size. `"background"` lays it behind the
statement instead. The eyebrow is a quiet pill, and `eyebrowHref` turns it into a link to the
announcement it names.

Frame the product with `ProductFrame` so it reads as the product rather than as a loose
image. `stage="panel"` sets the frame on a tinted panel, the way a product shot is staged:

```tsx {% title="resources/components/landing/hero-shot.tsx" %}
import { ProductFrame } from "@sdxc/ui/patterns";

export function HeroShot() {
	return () => (
		<ProductFrame stage="panel" lights title="Status" url="status.example.com">
			<img
				src="/images/monitors.png"
				alt="Monitors dashboard with six regions passing"
			/>
		</ProductFrame>
	);
}
```

A rendered component works as well as an image, and stays sharp at every width.
`ProductFrame variant="device"` draws a phone instead, `shadow="tinted"` lifts a frame off a
brand band, and `CodeStage variant="slab"` frames a code sample when the product is a tool.

## Proof

`ProofStrip` is the ruled band right after the hero. Give it a `LogoCloud`, a `StatStrip`, or
both:

```tsx {% title="resources/components/landing/proof.tsx" %}
import { LogoCloud, StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

export function Proof() {
	return () => (
		<ProofStrip>
			<LogoCloud layout="spread" label="Trusted by on-call teams at" muted>
				<img src="/logos/northwind.svg" alt="Northwind" />
				<img src="/logos/voltage.svg" alt="Voltage" />
				<img src="/logos/layerline.svg" alt="Layerline" />
				<img src="/logos/fernway.svg" alt="Fernway" />
				<img src="/logos/quadrant.svg" alt="Quadrant" />
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

`LogoCloud` sizes every mark to one height, large enough to recognize, and `muted` draws them
in one ink (an image goes grayscale), so no customer's logo outshouts the others.
`layout="spread"` runs the marks edge to edge across the measure, and `layout="grid"` sets them
in ruled cells. `StatStrip` puts every figure on one row once the band is wide enough, and on a
phone gives an odd last figure the whole row.

<frame src="/frames/guides/landing-pages/proof">
The proof band: five muted wordmarks spread across the measure over three figures.
</frame>

## Feature bands

`FeatureBand` is the band a landing repeats. Its `layout` decides the body:

- `"split"` puts claims beside `media`. Children that are a `<ul>` render as checked claims.
- `"grid"` lays `Feature` cards in `columns`, two on a tablet and all of them on a wide band.
- `"steps"` numbers `StepList.Item` children for a "how it works" band.
- `"stage"` lists `TabbedStage.Item` children down a rail beside a sticky stage that shows the
  selected one's media.
- `"timeline"` sets `StepList.Item` children on a vertical rule, each with a `meta` line and
  optional `media`.

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
				title="Incidents write their own record"
				description={
					<>
						Every state change lands on the timeline as it happens, so the{" "}
						<strong>post-mortem is already written</strong> when the page
						clears.
					</>
				}
				media={
					<ProductFrame lights title="Incident #482">
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
				tone="brand"
				inset
				eyebrow="On-call"
				title="Built for the 3 a.m. page"
				columns={3}
			>
				<Feature>
					<Feature.Icon>
						<GlobeIcon />
					</Feature.Icon>
					<Feature.Title>Six probe regions</Feature.Title>
					<Feature.Description>
						Every check runs from <strong>three continents</strong>, so a
						local outage never hides behind a healthy one.
					</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<BellRingIcon />
					</Feature.Icon>
					<Feature.Title>Alerts that agree</Feature.Title>
					<Feature.Description>
						A page fires only when <strong>two regions</strong> see the
						failure, which keeps flaky networks off your phone.
					</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<GaugeIcon />
					</Feature.Icon>
					<Feature.Title>Latency per region</Feature.Title>
					<Feature.Description>
						Response time is charted per region, so you see{" "}
						<strong>slow before down</strong>.
					</Feature.Description>
				</Feature>
			</FeatureBand>

			<FeatureBand layout="steps" eyebrow="Setup" title="Live in three steps">
				<StepList.Item title="Add a monitor">
					Paste the URL you want watched and pick the regions that check it.
				</StepList.Item>
				<StepList.Item title="Pick who gets paged">
					Route alerts to a rotation, a channel, or a single phone.
				</StepList.Item>
				<StepList.Item title="Share the status page">
					Customers subscribe and hear about incidents before they ask.
				</StepList.Item>
			</FeatureBand>
		</>
	);
}
```

Alternate `tone` between bands (`"plain"`, `"tinted"`, `"grid"`, `"brand"`) so a reader can
tell where one ends and the next begins, and add `inset` to float a toned band as a rounded
panel inside the page. Leave `"inverse"` for the closing band, which uses it by default. A
`<strong>` in a description draws in the heading ink at the copy's weight, which gives a reader
scanning the band a second level without turning anything bold.

<frame src="/frames/guides/landing-pages/features">
The three feature bands: checked claims beside an incident timeline, an inset brand band of
three feature cards, and three numbered steps.
</frame>

## Questions

`FaqBand` takes one `Accordion`, or two for a pair of columns that stack into one list on a
narrow screen:

```tsx {% title="resources/components/landing/faq.tsx" %}
import { ChevronDownIcon } from "@sdxc/icons";
import { Accordion } from "@sdxc/ui";
import { FaqBand } from "@sdxc/ui/patterns";

const QUESTIONS = [
	[
		"How often do checks run?",
		"Every thirty seconds on paid plans and every three minutes on the free one. Each check runs from every region you pick, so one slow network never decides the result on its own.",
	],
	[
		"Can I use my own domain?",
		"Yes. Point a CNAME at your status page and the certificate is issued for you within a few minutes. Subscribers keep their emails when you switch domains.",
	],
	[
		"Is there a free plan?",
		"Five monitors and one status page, free for as long as you need them. No card is required, and upgrading keeps every check's history.",
	],
] as const;

export function Faq() {
	return () => (
		<FaqBand eyebrow="FAQ" title="Questions, answered">
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
	--ui-marketing-display-max: 6rem;
	--ui-marketing-lead-weight: 500;
	--ui-font-display: "Inter Display", var(--ui-font-sans);
}
```

That gives a wider column, pill-shaped calls to action, a larger top step for the hero
headline, heavier leads, and a display face for headlines. Sizes and band spacing are fluid in
the width of the band, so a phone gets the tight end of each without a breakpoint of yours.
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

- The demo landings — a [SaaS](/demo/saas), an [app](/demo/app) and a [book](/demo/book) built
  only from these bands, each with its own palette and type.
- [Landing patterns](/api/ui/landing-patterns) — every pattern assembled into one page.
- The Marketing group in the [`@sdxc/ui`](/api/ui) catalogue — a live demo and the full props
  of each band and primitive.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — replace the literal
  copy above with messages, since every string is already a prop.
