---
title: Generate believable test data
description: Seed test databases and component fixtures with realistic data that comes out identical on every run, so failures replay and snapshots hold.
section:
    title: Operations & testing
    order: 9
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to write one generator per fixture with `@sdxc/sample`"
    - "How to seed test databases and component previews with data identical on every run"
    - "How to keep snapshots stable and shake out hidden assumptions"
---

Tests written against `"Test User"` and `test@test.com` pass while the real thing breaks: the
name with an accent, the company name too long for its column, the invoice list with forty
rows instead of one. Random data finds those cases, and then fails once on a value nobody can
get back. [`@sdxc/sample`](/api/sample) gives you the first without the second. Every generator opens on
a seed, and the same seed with the same calls produces the same people, companies, amounts and
dates on any machine, on any day.

This guide builds factories for your `Account` and `Invoice` models and uses the same
generated data four ways: to seed your local database, to set up a test, to feed a component
preview, and to render snapshots that only change when your markup does. It assumes the test
setup from [Test Workers apps](/docs/operations-and-testing/testing).

```bash
npm add @sdxc/data-model @sdxc/random @sdxc/sample remix
```

`@sdxc/data-model/testing` and `@sdxc/data-model/seed` draw their values from `@sdxc/sample`,
so the app needs it installed. An app from `sdxc create` already depends on it, and
`sdxc make model`, `sdxc make factory` and `sdxc scaffold` add it to `package.json` when the
code they write imports those entries.

## Create one generator per fixture

A generator takes a seed and, optionally, the instant its `date` module measures from. Pin
both, in one module the previews, snapshots and property tests share:

```typescript {% title="app/test/sample.ts" %}
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

## Write factories

A factory, in `database/factories/`, gives every value a create needs, each a value or a
function of `{ sample, sequence, create }`. `sample` is a generator of the factory's own,
`sequence` counts its builds from one, and `create` writes another record the row needs:

```typescript {% title="database/factories/invoice.ts" %}
import { defineFactory } from "@sdxc/data-model/testing";

import { Invoice } from "~/app/models/invoice";
import { AccountFactory } from "~/database/factories/account";

export const InvoiceFactory = defineFactory(Invoice, {
	account_id: async ({ create }) => (await create(AccountFactory)).id,
	number: ({ sequence }) => `INV-${String(sequence).padStart(6, "0")}`,
	amount_cents: ({ sample }) => sample.number.int({ min: 1_000, max: 250_000 }),
	status: ({ sample }) =>
		sample.helpers.weightedPick([
			{ weight: 6, value: "paid" },
			{ weight: 3, value: "open" },
			{ weight: 1, value: "void" },
		]),
	issued_at: ({ sample }) => sample.date.past({ days: 90 }).getTime(),
	notes: ({ sample }) =>
		sample.helpers.maybe(() => sample.lorem.sentence(), { chance: 0.3 }),
}).trait("void", { status: "void" });
```

`weightedPick` makes most invoices paid and a few void, the mix a real list has, and `maybe`
leaves `notes` as `null` most of the time, so the empty case is covered without a test of its
own. A value that must be unique carries the `sequence`, so two rows never collide. Contact
details the generator writes can't reach anyone: emails and links use the domains reserved for
examples, and phone numbers come from the `555-01xx` range kept for fiction.

Every write goes through the model, so its callbacks and constraints run. A call overrides only
what it is about, and names traits before its overrides:

```typescript
await factories().create(InvoiceFactory, "void", { notes: null });
```

## Seed your local database

The rows a new local database starts with are declared once, in `database/seed.ts`, as named
steps over the app's model registry:

```typescript {% title="database/seed.ts" %}
import { defineSeed } from "@sdxc/data-model/seed";

import registry from "~/app/models";
import { AccountFactory } from "~/database/factories/account";
import { InvoiceFactory } from "~/database/factories/invoice";

export default defineSeed(registry, {
	admin: ({ models }) =>
		models.account.create({
			name: "Ada",
			email: "ada@example.com",
			company: "Acme",
		}),
	accounts: ({ factories }) => factories.createMany(AccountFactory, 10),
	invoices: async ({ models, factories }) => {
		for (let account of await models.account.query().all()) {
			await factories.createMany(InvoiceFactory, 4, { account_id: account.id });
		}
	},
});
```

A step writes fixed rows through `models` or generated ones through `factories`, and may read
what the steps before it wrote. The template's commands run it on the local database:

```bash
sdxc run db seed
sdxc run db fresh --seed
sdxc run db prepare
```

`db seed` runs every step and prints `Seeded <name>` for each. `db fresh --seed` drops every
local table, applies every migration and seeds, so it rebuilds the same rows each time: the
factories draw from seed 1 unless `seeder.run({ db }, { seed })` names another. `db prepare`
migrates, and seeds only a database that had no migration applied, so it is safe on every
start. All three refuse `--remote`. Every developer gets the same accounts, so a bug report
that names a customer points at the same row on every laptop.

## Set up a test

`app/test/database.ts` gives a test the same factories over the in-memory `DB` binding, with a
fixed seed. A test creates what it is about, requests a page, and checks it against what it
created:

```typescript {% title="app/http/controllers/invoices/index.test.tsx" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { factories, migrate } from "~/app/test/database";
import { InvoiceFactory } from "~/database/factories/invoice";

beforeAll(migrate);

test("the open filter lists every open invoice", async () => {
	let invoices = await factories().createMany(InvoiceFactory, 20);
	let open = invoices.filter((invoice) => invoice.status === "open");

	let response = await createWebRouter().fetch(
		new Request("https://example.com/invoices?status=open"),
	);
	let body = await response.text();

	expect(open.length).toBeGreaterThan(0);
	for (let invoice of open) expect(body).toContain(invoice.number);
});
```

The assertions read the expected values from the rows the factory answered instead of spelling
out a value the seed happens to produce, so the test states the rule, every open invoice is
listed, and keeps passing when a package update grows the word lists. The first expectation
guards the data itself: a filter test over zero open invoices would pass without testing
anything.

Each factory draws from a stream derived from its own name, so adding a column to
`AccountFactory` next month changes the accounts and leaves every invoice amount exactly where
it was.

## Feed component previews

A component worth previewing needs props that look like production, without a database. Build
those rows straight from a generator, in a module the previews and the snapshots share:

```typescript {% title="app/test/fixtures.ts" %}
import type { Sample } from "@sdxc/sample";

import type { AccountRow } from "~/app/models/account";
import type { InvoiceRow } from "~/app/models/invoice";

import { fixtureSample, REFERENCE } from "~/app/test/sample";

export interface InvoiceFixture {
	account: AccountRow;
	invoice: InvoiceRow;
}

export function invoiceValues(sample: Sample) {
	return {
		amount_cents: sample.number.int({ min: 1_000, max: 250_000 }),
		status: sample.helpers.weightedPick([
			{ weight: 6, value: "paid" as const },
			{ weight: 3, value: "open" as const },
			{ weight: 1, value: "void" as const },
		]),
		notes: sample.helpers.maybe(() => sample.lorem.sentence(), { chance: 0.3 }),
	};
}

export function invoiceFixture(seed: string): InvoiceFixture {
	let sample = fixtureSample(seed);
	let person = sample.person.record();
	let stamps = { created_at: REFERENCE.getTime(), updated_at: REFERENCE.getTime() };
	let account = {
		id: sample.string.uuid(),
		name: person.fullName,
		email: person.email,
		company: sample.company.name(),
		...stamps,
	};
	let invoice = {
		id: sample.string.uuid(),
		account_id: account.id,
		number: sample.helpers.fromRegExp("INV-[0-9]{6}"),
		issued_at: sample.date.past({ days: 90 }).getTime(),
		...invoiceValues(sample),
		...stamps,
	};
	return { account, invoice };
}
```

`person.record()` returns a whole person whose email and handle match their name, so the card
shows an account that agrees with itself.

A preview page renders your `InvoiceCard` with it, and takes the seed from the query string:

```tsx {% title="app/http/controllers/previews/invoice-card.tsx" %}
import { createAction } from "remix/router";

import { invoiceFixture } from "~/app/test/fixtures";
import { InvoiceCard } from "~/resources/components/invoice-card";
import routes from "~/routes/web";

export default createAction(routes.previews.invoiceCard, (ctx) => {
	let seed = ctx.url.searchParams.get("seed") ?? "invoice-card";
	let { account, invoice } = invoiceFixture(seed);
	return ctx.render(<InvoiceCard account={account} invoice={invoice} />);
});
```

Changing `?seed=` flips through variations: a long company name, a void invoice, notes that
wrap. A seed doesn't choose a variation, it replays one, so when a card looks wrong the URL is
the bug report: the same seed renders the same card for whoever opens it. Map the route only in
development, so the previews never ship.

## Keep snapshots stable

A snapshot records output and fails when it changes, which is only useful when nothing but
your code can change it. Generated data meets that bar once the seed and the reference
instant are fixed:

```tsx {% title="resources/components/invoice-card.test.tsx" %}
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

import { invoiceFixture } from "~/app/test/fixtures";
import { InvoiceCard } from "~/resources/components/invoice-card";

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
seed, the ids from the seeded `string.uuid()` rather than a fresh random UUID, and the
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

```typescript {% title="app/services/invoice-totals.test.ts" %}
import { systemSeed } from "@sdxc/random";
import { createSample } from "@sdxc/sample";
import { describe, expect, test } from "vitest";

import { totals } from "~/app/services/invoice-totals";
import { invoiceValues } from "~/app/test/fixtures";

const SEED = Number(process.env.SAMPLE_SEED) || systemSeed();

describe(`invoice totals (SAMPLE_SEED=${SEED})`, () => {
	test("the totals per status add up to the whole", () => {
		let sample = createSample({ seed: SEED });
		let build = () => invoiceValues(sample);
		let sum = totals(sample.helpers.multiple(build, { count: 200 }));

		expect(sum.paid + sum.open + sum.void).toBe(sum.all);
	});
});
```

`totals` is your own function. `systemSeed()` from `@sdxc/random` draws a 32-bit seed from Web
Crypto. Because the seed is in the suite's name, a failure prints it, and
`SAMPLE_SEED=<seed> vp test run app/services` replays that exact run down to the last field.

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing) — the test database, the router
  and the Vitest projects these tests run in.
- [Make a factory](/docs/sdxc/make-factory) — what `sdxc make factory` writes.
- [Write executable specs](/docs/operations-and-testing/executable-specs) — the same seeded
  generation, drawn inside a `.spec` suite.
