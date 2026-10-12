# @sdxc/cloudflare-pricing

Cloudflare Developer Platform list prices, one module per service, with the arithmetic that turns them into cents.

## Installation

```sh
npm add @sdxc/cloudflare-pricing
```

## Usage

### Price a measured quantity

Every billed dimension is a `Meter`, exported from its service's entry point. `centsPerUnit()` turns one into cents per unit.

```typescript
import { centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as D1 from "@sdxc/cloudflare-pricing/d1";

let cents = 1_200 * centsPerUnit(D1.ROWS_READ) + 40 * centsPerUnit(D1.ROWS_WRITTEN);
```

### Price a day of storage

Storage is published per GB-month; `centsPerGbDay()` spreads it over a 30-day billing month.

```typescript
import { centsPerGbDay } from "@sdxc/cloudflare-pricing";
import * as KV from "@sdxc/cloudflare-pricing/kv";

let cents = 0.4 * centsPerGbDay(KV.STORAGE); // 0.4 GB held for one day
```

### Read what a plan includes

`included` is the Workers Paid allowance before the price applies; `freeLimit` is the Workers Free plan's limit.

```typescript
import * as Queues from "@sdxc/cloudflare-pricing/queues";

Queues.OPERATIONS.included; // { quantity: 1_000_000, period: "month" }
Queues.OPERATIONS.freeLimit; // { quantity: 10_000, period: "day" }
```

### Price quantities with a rate card

`defineRateCard()` fixes cents per unit for each resource you meter. Accumulate into `zero()`, then `price()` the total.

```typescript
import { centsPerUnit, defineRateCard } from "@sdxc/cloudflare-pricing";
import * as D1 from "@sdxc/cloudflare-pricing/d1";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

let card = defineRateCard({
	workerRequests: centsPerUnit(Workers.REQUESTS),
	d1RowsRead: centsPerUnit(D1.ROWS_READ),
});

let quantities = card.zero();
quantities.workerRequests += 1;
quantities.d1RowsRead += 1_200;

let cents = card.price(quantities);
```

## API

### `centsPerUnit(meter: Meter): number`

The list price of one `meter.unit`, in cents, ignoring any allowance.

```typescript
centsPerUnit(Workers.REQUESTS); // 0.00003, the same as (0.3 * 100) / 1_000_000
```

### `centsPerGbDay(meter: Meter<"GB-month">): number`

The price of holding one GB for one day, in cents; only storage meters type-check.

```typescript
centsPerGbDay(D1.STORAGE); // 2.5, the same as (0.75 * 100) / 30
```

### `DAYS_PER_BILLING_MONTH`

`30`, the month Cloudflare averages a GB-month over.

### `defineRateCard(rates: Record<R, number>): RateCard<R>`

A frozen card of cents per unit keyed by resource. `resources` lists the keys in the order written, so append new resources at the end and name them with words (integer-like keys such as `"0"` sort first). `zero()` answers a fresh all-zero set of quantities; `price(quantities)` accepts a partial set and sums `max(0, units) × rate` per resource.

### Service entry points

Each exports its meters, `PRICING_DOCS_URL` (the Cloudflare page the prices come from) and `PRICES_VERIFIED_ON` (the ISO date they were last compared against it). Every price is the Workers Paid overage rate.

| Entry point                                 | Meters and helpers                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@sdxc/cloudflare-pricing/workers`          | `REQUESTS`, `CPU_MS`, `LOG_EVENTS_WRITTEN`                                                                                                                                                             |
| `@sdxc/cloudflare-pricing/durable-objects`  | `REQUESTS`, `DURATION` (GB-s), `SQLITE_ROWS_READ`, `SQLITE_ROWS_WRITTEN`, `SQLITE_STORAGE`, `BILLED_MEMORY_GB` (`0.128`), `centsPerActiveMs()`                                                         |
| `@sdxc/cloudflare-pricing/d1`               | `ROWS_READ`, `ROWS_WRITTEN`, `STORAGE`                                                                                                                                                                 |
| `@sdxc/cloudflare-pricing/kv`               | `READS`, `WRITES`, `DELETES`, `LISTS`, `STORAGE`                                                                                                                                                       |
| `@sdxc/cloudflare-pricing/queues`           | `OPERATIONS`, one per 64 KB of each message written, read or deleted                                                                                                                                   |
| `@sdxc/cloudflare-pricing/analytics-engine` | `DATA_POINTS_WRITTEN`, `READ_QUERIES`, `BILLING_ACTIVE`, `billedCentsPerUnit(meter)`                                                                                                                   |
| `@sdxc/cloudflare-pricing/email-service`    | `EMAILS_SENT`, outbound sends through the `send_email` binding                                                                                                                                         |
| `@sdxc/cloudflare-pricing/r2`               | `STORAGE`, `CLASS_A_OPERATIONS`, `CLASS_B_OPERATIONS`, `INFREQUENT_ACCESS_STORAGE`, `INFREQUENT_ACCESS_CLASS_A_OPERATIONS`, `INFREQUENT_ACCESS_CLASS_B_OPERATIONS`, `INFREQUENT_ACCESS_DATA_RETRIEVAL` |

`centsPerActiveMs()` is the price of one millisecond a Durable Object stays active: the `DURATION` rate at `BILLED_MEMORY_GB`. `billedCentsPerUnit(meter)` is `centsPerUnit(meter)` while `BILLING_ACTIVE` is `true` and zero while Cloudflare publishes Analytics Engine prices without invoicing them.

The helpers return exact per-unit rates, while Cloudflare rounds billable usage up to its billing unit (R2 to the next million operations or whole GB-month, Durable Objects to the next million GB-s), so a small overage costs more on the invoice than the rate predicts.

Prices are transcribed from Cloudflare's pricing docs, each service's page at its `PRICING_DOCS_URL`, published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### Types

```typescript
interface Meter<U extends Unit = Unit> {
	unit: U;
	price: Price; // as published: $0.001 per million rows is { usd: 0.001, per: 1_000_000 }
	included: Allowance | null; // Workers Paid allowance, account-wide; null when every unit bills
	freeLimit: Allowance | null; // Workers Free limit; null when unavailable there or unlimited
}

interface Price {
	usd: number;
	per: number;
}

interface Allowance {
	quantity: number; // in the meter's unit; GB held at once when period is "total"
	period: "day" | "month" | "invocation" | "total"; // AllowancePeriod
}

interface RateCard<R extends string> {
	readonly resources: readonly R[];
	readonly rates: Readonly<Record<R, number>>;
	zero(): RateCardQuantities<R>;
	price(quantities: Partial<RateCardQuantities<R>>): number;
}

type RateCardQuantities<R extends string> = Record<R, number>;
type RateCardResource<C> = C extends RateCard<infer R> ? R : never; // a card's resource names
```

`Unit` is the union of every published unit, from `"request"` and `"CPU ms"` to `"Class A operation"` and `"GB-month"`.

## Pattern: A Rate Card For A Cost Ledger

Derive every rate once, store quantities rather than cents so a corrected price can re-price history, and stamp each record with the card's version. Writing quantities by position in `resources` keeps records compact, which is why the card's key order only grows at the end.

```typescript
import type { RateCardQuantities, RateCardResource } from "@sdxc/cloudflare-pricing";

import { centsPerGbDay, centsPerUnit, defineRateCard } from "@sdxc/cloudflare-pricing";
import * as D1 from "@sdxc/cloudflare-pricing/d1";
import * as DurableObjects from "@sdxc/cloudflare-pricing/durable-objects";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

const RATE_CARD_VERSION = "2026-09-28";

const COST_RATE_CARD = defineRateCard({
	workerRequests: centsPerUnit(Workers.REQUESTS),
	workerCpuMs: centsPerUnit(Workers.CPU_MS),
	objectActiveMs: DurableObjects.centsPerActiveMs(),
	d1RowsRead: centsPerUnit(D1.ROWS_READ),
	d1RowsWritten: centsPerUnit(D1.ROWS_WRITTEN),
	d1StorageGbDays: centsPerGbDay(D1.STORAGE),
});

type CostQuantities = RateCardQuantities<RateCardResource<typeof COST_RATE_CARD>>;

function toRecord(quantities: CostQuantities) {
	return {
		version: RATE_CARD_VERSION,
		cents: COST_RATE_CARD.price(quantities),
		quantities: COST_RATE_CARD.resources.map((resource) => quantities[resource]),
	};
}

function fromRecord(record: { quantities: number[] }): CostQuantities {
	let quantities = COST_RATE_CARD.zero();
	COST_RATE_CARD.resources.forEach((resource, index) => {
		quantities[resource] = record.quantities[index] ?? 0;
	});
	return quantities;
}
```

## Pattern: Estimating A Monthly Bill

`included` is an account-wide monthly allowance, so subtract it from the account's monthly total, never from one customer's share.

```typescript
import type { Meter } from "@sdxc/cloudflare-pricing";

import { centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as KV from "@sdxc/cloudflare-pricing/kv";

function overageCents(meter: Meter, monthlyUnits: number) {
	let included = meter.included?.period === "month" ? meter.included.quantity : 0;
	return Math.max(0, monthlyUnits - included) * centsPerUnit(meter);
}

overageCents(KV.READS, 25_000_000); // 750: 15 million reads past the 10 million included
```

## Pattern: Checking Usage Against The Free Plan

`freeLimit` is where the Workers Free plan stops serving. Daily limits reset at 00:00 UTC; `"invocation"` caps a single call and `"total"` caps GB held at once.

```typescript
import type { Meter } from "@sdxc/cloudflare-pricing";

import * as D1 from "@sdxc/cloudflare-pricing/d1";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

function freeHeadroom(meter: Meter, used: number) {
	if (meter.freeLimit === null) return null;
	return { remaining: Math.max(0, meter.freeLimit.quantity - used), per: meter.freeLimit.period };
}

freeHeadroom(D1.ROWS_WRITTEN, 80_000); // { remaining: 20_000, per: "day" }
freeHeadroom(Workers.CPU_MS, 4); // { remaining: 6, per: "invocation" }
```

## Pattern: Metering Durable Object Time In Milliseconds

Every object bills on 128 MB of memory, so `centsPerActiveMs()` lets a ledger price the active milliseconds it measures instead of converting to GB-s.

```typescript
import * as DurableObjects from "@sdxc/cloudflare-pricing/durable-objects";

let activeMs = 45_000;
let cents = activeMs * DurableObjects.centsPerActiveMs(); // 0.00000016 cents per ms
// the same as seconds × BILLED_MEMORY_GB × the DURATION rate per GB-s
```

## Pattern: Metering Analytics Engine Before It Bills

`billedCentsPerUnit()` prices Analytics Engine at zero while `BILLING_ACTIVE` is `false`, so a card built with it counts points and queries today and starts charging for them in the release that marks billing active.

```typescript
import { centsPerUnit, defineRateCard } from "@sdxc/cloudflare-pricing";
import * as AnalyticsEngine from "@sdxc/cloudflare-pricing/analytics-engine";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

let card = defineRateCard({
	workerRequests: centsPerUnit(Workers.REQUESTS),
	analyticsPoints: AnalyticsEngine.billedCentsPerUnit(AnalyticsEngine.DATA_POINTS_WRITTEN),
	analyticsQueries: AnalyticsEngine.billedCentsPerUnit(AnalyticsEngine.READ_QUERIES),
});

card.price({ workerRequests: 1, analyticsPoints: 10 }); // only the request costs, for now
```

## Pattern: Comparing R2 Storage Classes

Standard storage includes R2's free tier on every account; Infrequent Access is cheaper to hold, has no free tier, and charges per GB retrieved.

```typescript
import { centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as R2 from "@sdxc/cloudflare-pricing/r2";

interface Usage {
	gbMonths: number;
	reads: number;
	gbRetrieved: number;
}

function standardCents(usage: Usage) {
	let storage = Math.max(0, usage.gbMonths - (R2.STORAGE.included?.quantity ?? 0));
	let reads = Math.max(0, usage.reads - (R2.CLASS_B_OPERATIONS.included?.quantity ?? 0));
	return storage * centsPerUnit(R2.STORAGE) + reads * centsPerUnit(R2.CLASS_B_OPERATIONS);
}

function infrequentAccessCents(usage: Usage) {
	return (
		usage.gbMonths * centsPerUnit(R2.INFREQUENT_ACCESS_STORAGE) +
		usage.reads * centsPerUnit(R2.INFREQUENT_ACCESS_CLASS_B_OPERATIONS) +
		usage.gbRetrieved * centsPerUnit(R2.INFREQUENT_ACCESS_DATA_RETRIEVAL)
	);
}

let archive = { gbMonths: 500, reads: 20_000, gbRetrieved: 2 };
standardCents(archive) < infrequentAccessCents(archive); // false: rarely read data is cheaper in IA
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/cloudflare-pricing": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
