---
title: Generate believable test data
description: Seed test databases and component fixtures with realistic data that comes out identical on every run, so failures replay and snapshots hold.
section:
    title: Operations & testing
    order: 8
order: 4
lastUpdated: 2026-09-29
---

Tests written against `"Test User"` and `test@test.com` pass while the real thing breaks: the
name with an accent, the company name too long for its column, the invoice list with forty
rows instead of one. Random data finds those cases, and then fails once on a value nobody can get back.
[`@sdxc/sample`](/api/sample) gives you the first without the second. Every generator opens on
a seed, and the same seed with the same calls produces the same people, companies, amounts and
dates on any machine, on any day.

This guide builds one set of factories for your `Accounts` and `Invoices`, and uses it three
ways: to seed a test database, to feed a component preview, and to render snapshots that only
change when your markup does. It assumes the test setup from
[Test Workers apps](/docs/operations-and-testing/testing).

```bash
npm add -D @sdxc/sample
```

## One generator per fixture

A generator takes a seed and, optionally, the instant its `date` module measures from. Pin
both, in one module the tests and the previews share:

```typescript {% title="app/fixtures/sample.ts" %}
import { createSample } from "@sdxc/sample";

export const REFERENCE = new Date("2026-06-15T12:00:00Z");

export function fixtureSample(seed: string) {
	return createSample({ seed, now: REFERENCE });
}
```

The seed is required on purpose, so every run's data is replayable from something you can
name. The reference instant is what keeps dates put: without it, "an invoice issued in the last
90 days" moves every day, and so does every page that shows how long ago it was. Name seeds
after what they are for, like `"invoice-list"`, so two tests never share a stream by accident.

## Write factories that agree with themselves

A factory draws one row's worth of input for your model. The generator's modules return the
pieces, and `person.record()` returns a whole person whose email and handle match their name:

```typescript {% title="app/fixtures/factories.ts" %}
import type { Sample } from "@sdxc/sample";

import type { AccountInput } from "~/app/data/account";
import type { InvoiceInput } from "~/app/data/invoice";

export function accountInput(sample: Sample): AccountInput {
	let person = sample.person.record();
	let country = sample.location.country();
	return {
		name: person.fullName,
		email: person.email,
		company: sample.company.name(),
		country,
		city: sample.location.city({ country }),
		createdAt: sample.date.past({ days: 365 }),
	};
}

export function invoiceInput(sample: Sample, accountId: string): InvoiceInput {
	return {
		accountId,
		number: sample.helpers.fromRegExp("INV-[0-9]{6}"),
		amountCents: sample.number.int({ min: 1_000, max: 250_000 }),
		status: sample.helpers.weightedPick([
			{ weight: 6, value: "paid" as const },
			{ weight: 3, value: "open" as const },
			{ weight: 1, value: "void" as const },
		]),
		issuedAt: sample.date.past({ days: 90 }),
		notes: sample.helpers.maybe(() => sample.lorem.sentence(), { chance: 0.3 }),
	};
}
```

Reading the country first and passing it to `city({ country })` keeps an address believable: a
city in the country it claims. `weightedPick` makes most invoices paid and a few void, the mix a
real list has, and `maybe` leaves `notes` as `null` most of the time, so the empty case is
covered without a test of its own. Contact details can't reach anyone: emails and links use the
domains reserved for examples, and phone numbers come from the `555-01xx` range kept for
fiction.

## Seed a test database

A seeding function writes a believable amount of data through your own models, with each part
drawing from a stream of its own:

```typescript {% title="app/test/seed.ts" %}
import type { Sample } from "@sdxc/sample";
import type { Database } from "remix/data-table";

import Accounts from "~/app/data/account";
import Invoices from "~/app/data/invoice";
import { accountInput, invoiceInput } from "~/app/fixtures/factories";

export async function seedDatabase(db: Database, sample: Sample, accounts = 10) {
	let people = sample.derive("accounts");
	let billing = sample.derive("invoices");
	let seeded = [];

	for (let index = 0; index < accounts; index++) {
		let account = await Accounts.create(db, accountInput(people));
		let count = billing.number.int({ min: 0, max: 6 });
		let build = () => invoiceInput(billing, account.id);
		let invoices = billing.helpers.multiple(build, { count });
		for (let input of invoices) await Invoices.create(db, input);
		seeded.push({ account, invoices });
	}

	return seeded;
}
```

Values follow the order of the calls, so adding one call shifts everything drawn after it.
`derive(label)` opens an independent stream named by its label, which is why this uses two:
when you add a `phone` field to `accountInput` next month, the accounts change and every
invoice amount stays exactly where it was.

A test then seeds a fresh database, requests a page, and checks it against what was seeded:

```typescript {% title="app/http/controllers/invoices.test.ts" %}
import { expect, test } from "vitest";

import { fixtureSample } from "~/app/fixtures/sample";
import { createTestDatabase, fetchApp } from "~/app/test/router";
import { seedDatabase } from "~/app/test/seed";

test("the open filter lists every open invoice", async () => {
	let db = await createTestDatabase();
	let seeded = await seedDatabase(db, fixtureSample("invoice-list"));
	let open = seeded
		.flatMap((entry) => entry.invoices)
		.filter((invoice) => invoice.status === "open");

	let response = await fetchApp(db, "/invoices?status=open");
	let body = await response.text();

	expect(open.length).toBeGreaterThan(0);
	for (let invoice of open) expect(body).toContain(invoice.number);
});
```

`createTestDatabase` and `fetchApp` are the helpers from the testing guide. The assertions
read the expected values from `seeded` instead of spelling out a name the seed happens to
produce, so the test states the rule, every open invoice is listed, and keeps passing when a
package update grows the name lists. The first expectation guards the seed itself: a filter
test over zero open invoices would pass without testing anything.

A development database can use the same function. A development-only route that calls
`seedDatabase(ctx.db, fixtureSample("local-dev"))` gives every developer the same accounts,
so a bug report that names a customer points at the same row on every laptop.

## Feed component previews

A component worth previewing needs props that look like production. Build the fixture once,
with ids, from the same factories:

```typescript {% title="app/fixtures/invoice.ts" %}
import type { Account } from "~/app/data/account";
import type { Invoice } from "~/app/data/invoice";

import { accountInput, invoiceInput } from "~/app/fixtures/factories";
import { fixtureSample } from "~/app/fixtures/sample";

export interface InvoiceFixture {
	account: Account;
	invoice: Invoice;
}

export function invoiceFixture(seed: string): InvoiceFixture {
	let sample = fixtureSample(seed);
	let account = { id: sample.string.uuid(), ...accountInput(sample) };
	let invoice = { id: sample.string.uuid(), ...invoiceInput(sample, account.id) };
	return { account, invoice };
}
```

A preview page renders your `InvoiceCard` with it, and takes the seed from the query string:

```tsx {% title="app/http/controllers/previews/invoice-card.tsx" %}
import { createAction } from "remix/router";

import { InvoiceCard } from "~/app/components/invoice-card";
import { invoiceFixture } from "~/app/fixtures/invoice";
import routes from "~/routes/web";

export default createAction(routes.previews.invoiceCard, (ctx) => {
	let seed = ctx.url.searchParams.get("seed") ?? "invoice-card";
	let { account, invoice } = invoiceFixture(seed);
	return ctx.render(<InvoiceCard account={account} invoice={invoice} />);
});
```

Changing `?seed=` flips through variations: a long company name, a void invoice, notes that
wrap. A seed doesn't choose a variation, it replays one, so when a card looks wrong the URL is
the bug report: the same seed renders the same card for whoever opens it. Map the route only in development, so the previews never ship.

## Keep snapshots stable

A snapshot records output and fails when it changes, which is only useful when nothing but
your code can change it. Generated data meets that bar once the seed and the reference
instant are fixed:

```tsx {% title="app/components/invoice-card.test.tsx" %}
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

import { InvoiceCard } from "~/app/components/invoice-card";
import { invoiceFixture } from "~/app/fixtures/invoice";

test.each(["invoice-card", "invoice-card-2", "invoice-card-5"])(
	"an invoice card renders the same markup for %s",
	async (seed) => {
		let { account, invoice } = invoiceFixture(seed);
		let html = await renderToString(
			<InvoiceCard account={account} invoice={invoice} />,
		);
		await expect(html).toMatchFileSnapshot(
			`./__snapshots__/invoice-card.${seed}.html`,
		);
	},
);
```

The seeds are the ones worth keeping: browse the preview until one renders a case you care
about, such as a void invoice with long notes, and add it to the list. Each part of the markup
holds still for its own reason. The names and amounts come from the
seed, the ids from the seeded `string.uuid()` rather than `crypto.randomUUID()`, and the
dates from `REFERENCE` rather than the clock. What is left is the component, so a failing
snapshot is a change you made. Format dates with an explicit `timeZone` in the component too,
or the same instant renders differently on a laptop and in CI.

When you upgrade `@sdxc/sample` and its word lists grow, the snapshots change together, in one
diff you review once. That is the trade: values are reproducible for a given version, not
promised across versions, which is also why the database test above asserts rules rather than
names.

## Shake out hidden assumptions

Fixed seeds make a suite repeatable, and they also let it lean on one lucky set of values. For
code that should hold for any input, draw a fresh seed each run and print it where a failure
shows it:

```typescript {% title="app/data/invoice-totals.test.ts" %}
import { createSample, systemSeed } from "@sdxc/sample";
import { describe, expect, test } from "vitest";

import { totals } from "~/app/data/invoice-totals";
import { invoiceInput } from "~/app/fixtures/factories";

const SEED = Number(process.env.SAMPLE_SEED) || systemSeed();

describe(`invoice totals (SAMPLE_SEED=${SEED})`, () => {
	test("the totals per status add up to the whole", () => {
		let sample = createSample({ seed: SEED });
		let build = () => invoiceInput(sample, "account-1");
		let sum = totals(sample.helpers.multiple(build, { count: 200 }));

		expect(sum.paid + sum.open + sum.void).toBe(sum.all);
	});
});
```

`totals` is your own function. `systemSeed()` draws a 32-bit seed from a strong random source.
Because the seed is in the suite's name, a failure prints it, and
`SAMPLE_SEED=<seed> vp test run app/data` replays that exact run down to the last field.

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing): the test database, `fetchApp`
  and the Vitest projects these tests run in.
- [Write executable specs](/docs/operations-and-testing/executable-specs): the same seeded
  generation, drawn inside a `.spec` suite.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases): the models the
  seeding function writes through.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui): the
  components the previews render.
