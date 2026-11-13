---
title: Build a pricing calculator
description: Price a reader's usage on the server from a GET form, print the bill into the page, and re-price it while they type, with the form still working for a browser running no script.
section:
    title: Interface
    order: 4.5
order: 8
lastUpdated: 2026-11-13
outcomes:
    - "How to compute a bill from the query string and print it with UsageEstimate"
    - "How to re-price as the reader types with UsageEstimate's live mode"
    - "How to answer the bill's frame with the bill alone"
---

A usage price is easier to trust when the reader types their own numbers and sees the bill.
`UsageEstimate` from [`@sdxc/ui/landing`](/api/ui/usage-estimate) is that calculator built as a
GET form: the numbers travel in the address, the server prices them, and the page comes back
with the bill printed. Live mode adds one island that re-requests only the bill as the reader
types. The prices stay on the server either way, so the page never ships your rates as code.

```bash
npm add @sdxc/ui remix
```

## Price the query

Keep the arithmetic in one function that reads the query and returns lines in cents. The page,
the bill frame and a test all call it:

```typescript {% title="app/services/pricing-estimate.ts" %}
const FREE_HOURS = 10;
const RATE_CENTS = 36;

export interface Estimate {
	hours: number;
	rows: Array<{ label: string; detail: string; cents: number }>;
	totalCents: number;
}

export function estimate(query: URLSearchParams): Estimate {
	let hours = Math.max(0, Math.min(10_000, Number(query.get("hours") ?? 40) || 0));
	let billed = Math.max(0, hours - FREE_HOURS);
	let rows = [
		{ label: "Free hours", detail: `${Math.min(hours, FREE_HOURS)} h`, cents: 0 },
		{
			label: "Recorded hours",
			detail: `${billed} h × $0.36`,
			cents: billed * RATE_CENTS,
		},
	];
	return { hours, rows, totalCents: rows.reduce((sum, row) => sum + row.cents, 0) };
}
```

Clamp every number you read: the query is the reader's to edit, and an out-of-range value
should price as the nearest one you sell.

## Print the bill

`UsageEstimate.Bill` lays out the lines, the total under a rule, a footnote and the page's next
step. Pass it as `bill`, and the form's fields named the way `estimate` reads them:

```tsx {% title="resources/components/pricing.tsx" %}
import type { Handle } from "remix/component";

import { LinkButton, TextField } from "@sdxc/ui";
import { UsageEstimate } from "@sdxc/ui/landing";

import { estimate } from "~/app/services/pricing-estimate";

function formatCents(cents: number) {
	return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(
		cents / 100,
	);
}

export function Bill(handle: Handle<{ url: URL }>) {
	return () => {
		let bill = estimate(handle.props.url.searchParams);
		return (
			<UsageEstimate.Bill
				label="Estimated monthly bill"
				rows={bill.rows.map((row) => ({
					...row,
					amount: formatCents(row.cents),
				}))}
				total={{
					label: `For ${bill.hours} hours`,
					amount: formatCents(bill.totalCents),
				}}
				footnote="Billed monthly on the hours you actually record."
				cta={
					<LinkButton href="/sign-up" color="brand">
						Start free
					</LinkButton>
				}
			/>
		);
	};
}

export function Pricing(handle: Handle<{ url: URL }>) {
	return () => (
		<section id="pricing">
			<UsageEstimate
				action="#pricing"
				submitLabel="Update the estimate"
				fields={
					<TextField
						label="Hours a month"
						type="number"
						name="hours"
						min={0}
						defaultValue={
							handle.props.url.searchParams.get("hours") ?? "40"
						}
					/>
				}
				bill={<Bill url={handle.props.url} />}
			/>
		</section>
	);
}
```

That is the whole calculator for a browser running no script. Submitting reloads the page at
`?hours=120#pricing`, so it opens on the new bill, and the address is a quote the reader can
bookmark or send.

## Re-price as they type

Swap `bill` for `live`. The bill becomes a blocking frame named `frame` that first loads `src`,
the page's own address, so the server still prints it into the page:

```tsx {% title="resources/components/pricing.tsx" %}
<UsageEstimate
	action="#pricing"
	submitLabel="Update the estimate"
	fields={fields}
	live={{
		frame: "pricing-bill",
		src: `${url.pathname}${url.search}`,
	}}
/>
```

With the island loaded, every input waits for `delay` milliseconds of quiet (250 by default),
then reloads the frame from the form's address with its current query. A newer request
replaces one still in flight, so the bill always matches what the fields show. The submit
button stays, and still works.

Map the island in the browser entry, as
[Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it#register-the-client-entry)
shows:

```typescript {% title="config/client-modules.ts" %}
export const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/landing/usage-estimate": () =>
		import("@sdxc/ui/landing/usage-estimate"),
};
```

## Answer the frame

The frame asks the same address for its content, naming itself in the `X-Remix-Target` header.
Answer that request with the bill alone, and mark the response as varying by the header so a
cache never serves the fragment for a page load:

```tsx {% title="app/http/controllers/pricing.tsx" %}
export default createAction(routes.pricing, async (ctx) => {
	let url = new URL(ctx.request.url);
	if (ctx.request.headers.get("X-Remix-Target") === "pricing-bill") {
		let response = await ctx.render(<Bill url={url} />);
		response.headers.append("Vary", "X-Remix-Target");
		return response;
	}
	return ctx.render(<PricingPage url={url} />);
});
```

[Build a search dialog](/docs/building-remix-apps/search-dialog#answer-the-frame-with-a-fragment)
covers answering a frame in more depth.

## Where to go next

- [`UsageEstimate`](/api/ui/usage-estimate) — every prop of the calculator and its bill, with a
  live demo.
- [Build a landing page](/docs/building-remix-apps/landing-pages) — the bands around it.
- [Test your app](/docs/operations-and-testing/test-your-app) — hold `estimate` to the prices
  on your pricing page.
