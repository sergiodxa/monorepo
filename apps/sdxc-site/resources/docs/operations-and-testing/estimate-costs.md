---
title: Estimate what your Worker costs
description: Turn requests, CPU time, KV reads and D1 rows into cents with Cloudflare's list prices, and warn before a month runs over budget.
section:
    title: Operations & testing
    order: 9
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How to turn requests, CPU time, KV reads and D1 rows into cents"
    - "How to price one unit of work with a rate card and see which binding dominates"
    - "How to warn before a month runs over budget"
---

Cloudflare's invoice arrives after the month is over, and by then a runaway cron job or a cache
that stopped caching has already cost what it cost. The prices are public, though, and most of
the usage they apply to is something your app can count. This guide turns usage numbers into
an estimated bill, prices a single request so you can see which binding dominates, counts D1
rows as they are read, and runs a daily job that warns when the month is heading past a budget.

[`@sdxc/cloudflare-pricing`](/api/cloudflare-pricing) holds the Developer Platform list prices,
one module per service, with the arithmetic and the rate cards that turn them into cents. It
has no dependencies and does no work at import time, so it is safe anywhere in a Worker.
[`@sdxc/data-table-d1`](/api/data-table-d1) reports what each D1 statement read and wrote, and
[`@sdxc/jobs`](/api/jobs) runs the forecast on a schedule.

```bash
npm add @sdxc/cloudflare-pricing @sdxc/data-table-d1 @sdxc/jobs @sdxc/logger remix
```

## A meter is a price and an allowance

Every billed dimension is a `Meter`: a `unit`, a `price` transcribed exactly as Cloudflare's
docs print it, what the Workers Paid plan `included`, and the Free plan's `freeLimit`.
`Workers.REQUESTS` is `$0.30` per million requests with 10 million included a month, and
`centsPerUnit(meter)` turns the price into cents for one unit:

```typescript
import { centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

centsPerUnit(Workers.REQUESTS); // 0.00003
Workers.REQUESTS.included; // { quantity: 10_000_000, period: "month" }
```

The service modules are `workers`, `durable-objects`, `d1`, `kv`, `queues`, `r2`,
`analytics-engine` and `email-service`. Prices are Workers Paid overage rates, before any
Enterprise discount, tax or the plan's own monthly fee.

## Estimate a month

Pick the meters your app uses and name each one after the usage you will feed it. The
`included` allowance resets every billing month across the whole account, so it comes off the
month's total before the price applies:

```typescript {% title="app/services/estimate.ts" %}
import type { Meter } from "@sdxc/cloudflare-pricing";

import { centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as D1 from "@sdxc/cloudflare-pricing/d1";
import * as KV from "@sdxc/cloudflare-pricing/kv";
import * as Queues from "@sdxc/cloudflare-pricing/queues";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

export const METERS = {
	requests: Workers.REQUESTS,
	cpuMs: Workers.CPU_MS,
	kvReads: KV.READS,
	kvWrites: KV.WRITES,
	d1RowsRead: D1.ROWS_READ,
	d1RowsWritten: D1.ROWS_WRITTEN,
	d1StorageGb: D1.STORAGE,
	queueOperations: Queues.OPERATIONS,
} satisfies Record<string, Meter>;

export type Usage = Record<keyof typeof METERS, number>;

export interface Line {
	units: number;
	billable: number;
	cents: number;
}

export function estimateMonth(usage: Usage) {
	let lines = {} as Record<keyof Usage, Line>;
	let totalCents = 0;

	for (let key of Object.keys(METERS) as (keyof Usage)[]) {
		let meter: Meter = METERS[key];
		let included =
			meter.included?.period === "month" ? meter.included.quantity : 0;
		let billable = Math.max(0, usage[key] - included);
		let cents = billable * centsPerUnit(meter);
		lines[key] = { units: usage[key], billable, cents };
		totalCents += cents;
	}

	return { lines, totalCents };
}
```

`D1.STORAGE` is priced per GB-month, so `d1StorageGb` is the average number of gigabytes the
database held over the month.

> [!NOTE]
> The result is a floor rather than the invoice. Cloudflare rounds billable usage up to its next
> billing unit, such as R2 to the next million operations and Durable Objects to the next million
> GB-seconds, so a small overage costs more than the exact rate predicts.

## Price one unit of work

The monthly estimate says what the account costs. What a single request or a single customer
costs is a different question, and there the allowance does not apply: it belongs to the
account, never to one customer's share of it. `defineRateCard` fixes cents per unit for each
resource you meter, and its `price` sums whatever quantities one unit of work consumed at the
list rate:

```typescript {% title="app/services/unit-cost.ts" %}
import {
	centsPerGbDay,
	centsPerUnit,
	defineRateCard,
} from "@sdxc/cloudflare-pricing";

import { METERS } from "~/app/services/estimate";

export const UNIT_COSTS = defineRateCard({
	requests: centsPerUnit(METERS.requests),
	cpuMs: centsPerUnit(METERS.cpuMs),
	kvReads: centsPerUnit(METERS.kvReads),
	kvWrites: centsPerUnit(METERS.kvWrites),
	d1RowsRead: centsPerUnit(METERS.d1RowsRead),
	d1RowsWritten: centsPerUnit(METERS.d1RowsWritten),
	d1StorageGbDays: centsPerGbDay(METERS.d1StorageGb),
	queueOperations: centsPerUnit(METERS.queueOperations),
});

UNIT_COSTS.price({ requests: 1, cpuMs: 8, kvReads: 2, d1RowsRead: 40 }); // 0.00015
```

A page view like that one costs $1.50 per million, and two thirds of it is the two KV reads,
which tells you which cache to fix before you have a bill to worry about. To total a whole
request, start from `UNIT_COSTS.zero()`, add to it as the request runs, and price it once at
the end.

## Count what you can measure

Some quantities your app sees directly. D1 returns the rows each statement read and wrote in
its response `meta`, and `@sdxc/data-table-d1` hands them to an `onStatement` observer, so
counting them costs no extra statement. Adding them to the current log record puts the totals
on every request's wide event:

```typescript {% title="app/initializers/database.ts" %}
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { currentLog } from "@sdxc/logger";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

export function openDatabase(): Database {
	return new Database(
		createD1DatabaseAdapter(env.DB, {
			onStatement({ rowsRead, rowsWritten }) {
				currentLog()
					?.inc("d1.rows_read", rowsRead)
					.inc("d1.rows_written", rowsWritten);
			},
		}),
	);
}
```

The observer runs once per statement, and anything it throws is swallowed rather than failing
the statement it measured. KV operations you count where you call the binding. CPU time is the
one figure the runtime does not report per request, so model it from the median your dashboard
shows.

## Warn before the bill arrives

A daily job can take the month so far, project it to the end of the billing month, and warn
while there is still time to act. Declare it with a cron schedule:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";

export default jobs({
	costs: {
		forecast: job({ cron: "0 6 * * *" }),
	},
});
```

The handler scales every operation meter by the days left and leaves storage alone, since a
GB-month is already an average over the month:

```typescript {% title="app/jobs/costs/forecast.ts" %}
import { DAYS_PER_BILLING_MONTH } from "@sdxc/cloudflare-pricing";
import { createJobHandler } from "@sdxc/jobs";

import type { Usage } from "~/app/services/estimate";

import jobs from "~/app/jobs";
import { estimateMonth, METERS } from "~/app/services/estimate";
import { readMonthToDate } from "~/app/services/usage";

const BUDGET_CENTS = 2_000;

function projectMonth(usage: Usage, elapsedDays: number): Usage {
	let projected = { ...usage };
	for (let key of Object.keys(usage) as (keyof Usage)[]) {
		if (METERS[key].unit === "GB-month") continue;
		projected[key] = (usage[key] / elapsedDays) * DAYS_PER_BILLING_MONTH;
	}
	return projected;
}

export default createJobHandler(jobs.costs.forecast, async (ctx) => {
	let usage = await readMonthToDate();
	let { totalCents } = estimateMonth(projectMonth(usage, new Date().getUTCDate()));

	let projectedCents = Math.round(totalCents);
	ctx.log.set({ costs: { projectedCents, budgetCents: BUDGET_CENTS } });
	if (projectedCents > BUDGET_CENTS) {
		ctx.log.warn("costs.over_budget", {
			projectedCents,
			budgetCents: BUDGET_CENTS,
		});
	}
});
```

`readMonthToDate` is your own module: it sums the counters your log records carry, or reads
Cloudflare's GraphQL Analytics API, and answers a `Usage`. A warning on the run's log record is
something your log pipeline can alert on. Map the handler in your dispatcher and add the cron
trigger, as [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) describes.

## Test what a known month costs

`estimateMonth` is plain arithmetic, so its test feeds it a month of usage and states the bill.
Releases of `@sdxc/cloudflare-pricing` are dated and any one may change a price, so pin an exact
version and let this test catch an upgrade that moves one.

```typescript {% title="app/services/estimate.test.ts" %}
import { expect, test } from "vitest";

import { estimateMonth } from "~/app/services/estimate";

const IDLE = {
	requests: 0,
	cpuMs: 0,
	kvReads: 0,
	kvWrites: 0,
	d1RowsRead: 0,
	d1RowsWritten: 0,
	d1StorageGb: 0,
	queueOperations: 0,
};

test("usage inside the allowances costs nothing", () => {
	let estimate = estimateMonth({ ...IDLE, requests: 9_000_000, d1StorageGb: 4 });
	expect(estimate.totalCents).toBe(0);
});

test("KV reads past the allowance bill at list price", () => {
	let estimate = estimateMonth({ ...IDLE, kvReads: 25_000_000 });
	expect(estimate.lines.kvReads.billable).toBe(15_000_000);
	expect(estimate.totalCents).toBeCloseTo(750);
});
```

Fifteen million reads past the ten million included, at $0.50 a million, is $7.50.

## Where to go next

- [Logs, traces and timings](/docs/operations-and-testing/observability) — the log records
  the counters and the warning land on.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — cut the
  reads the estimate says dominate.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — schedule the
  forecast and wire it into the Worker.
