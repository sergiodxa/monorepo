# @sdxc/cloudflare-pricing

Cloudflare Developer Platform list prices, one module per service, with the arithmetic that turns them into cents.

## Installation

```bash
npm add @sdxc/cloudflare-pricing
```

The package has no dependencies and does no work at import time, so it is safe in a Worker's global scope.

## Usage

### Price A Measured Quantity

```typescript
import { centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as D1 from "@sdxc/cloudflare-pricing/d1";

let cents = 1_200 * centsPerUnit(D1.ROWS_READ) + 40 * centsPerUnit(D1.ROWS_WRITTEN);
```

### Price A Day Of Storage

Storage is published per GB-month. `centsPerGbDay()` spreads it over the 30-day billing month, and accepts storage meters only.

```typescript
import { centsPerGbDay } from "@sdxc/cloudflare-pricing";
import * as KV from "@sdxc/cloudflare-pricing/kv";

let cents = 0.4 * centsPerGbDay(KV.STORAGE); // 0.4 GB held for one day
```

### Read What A Plan Includes

```typescript
import * as Queues from "@sdxc/cloudflare-pricing/queues";

let operationsThisMonth = 3_000_000;
let included = Queues.OPERATIONS.included?.quantity ?? 0; // 1,000,000 a month on Workers Paid
let billable = Math.max(0, operationsThisMonth - included);
```

## API

### `@sdxc/cloudflare-pricing`

#### `centsPerUnit(meter: Meter): number`

The list price of one `meter.unit`, in cents, as though no allowance applied.

```typescript
centsPerUnit(Workers.REQUESTS); // 0.00003
// same as
(0.3 * 100) / 1_000_000; // $0.30 per million requests
```

#### `centsPerGbDay(meter: Meter<"GB-month">): number`

The price of holding one GB for one day, in cents. Passing a meter whose unit is anything other than `"GB-month"` is a type error.

```typescript
centsPerGbDay(D1.STORAGE); // 2.5
// same as
(0.75 * 100) / 30; // $0.75 per GB-month over a 30-day month
```

#### `DAYS_PER_BILLING_MONTH`

`30`, the billing period Cloudflare averages a GB-month over.

#### Types

Every billed dimension is a `Meter`. Its `price` is transcribed exactly as the docs print it, so `$0.001 / million rows` is `{ usd: 0.001, per: 1_000_000 }`.

```typescript
interface Meter<U extends Unit = Unit> {
	unit: U;
	price: Price;
	/** Usage the Workers Paid plan includes before `price` applies; `null` when every unit bills. */
	included: Allowance | null;
	/** The Workers Free plan's limit; `null` when the service is unavailable there or has none. */
	freeLimit: Allowance | null;
}

interface Price {
	usd: number;
	per: number;
}

interface Allowance {
	/** In the meter's unit; GB held at once when `period` is `"total"`. */
	quantity: number;
	period: AllowancePeriod;
}

type AllowancePeriod = "day" | "month" | "invocation" | "total";
```

`Unit` is the union of every published unit: `"request"`, `"CPU ms"`, `"log event"`, `"GB-s"`, `"row read"`, `"row written"`, `"key read"`, `"key written"`, `"key deleted"`, `"list request"`, `"operation"`, `"data point"`, `"read query"`, `"email"`, `"Class A operation"`, `"Class B operation"`, `"GB retrieved"` and `"GB-month"`.

### Service Modules

Every service module exports `PRICING_DOCS_URL`, the page its prices are transcribed from, and `PRICES_VERIFIED_ON`, the ISO date they were last compared against it. Import one as a namespace:

```typescript
import * as DurableObjects from "@sdxc/cloudflare-pricing/durable-objects";
```

The prices were transcribed on 2026-09-27 from Cloudflare's official pricing docs, published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):

| Module             | Docs page                                                             |
| ------------------ | --------------------------------------------------------------------- |
| `workers`          | https://developers.cloudflare.com/workers/platform/pricing/           |
| `durable-objects`  | https://developers.cloudflare.com/durable-objects/platform/pricing/   |
| `d1`               | https://developers.cloudflare.com/d1/platform/pricing/                |
| `kv`               | https://developers.cloudflare.com/kv/platform/pricing/                |
| `queues`           | https://developers.cloudflare.com/queues/platform/pricing/            |
| `analytics-engine` | https://developers.cloudflare.com/analytics/analytics-engine/pricing/ |
| `email-service`    | https://developers.cloudflare.com/email-service/platform/pricing/     |
| `r2`               | https://developers.cloudflare.com/r2/pricing/                         |

Every price is the published Workers Paid overage rate; Enterprise contracts, discounts and taxes are outside it. The helpers return exact per-unit rates, while Cloudflare rounds billable usage up to the next billing unit (R2 to the next million operations or whole GB-month, Durable Objects to the next million GB-s), so a small overage costs more on the invoice than they predict. `included` resets each billing month across the whole account; `freeLimit` values reset daily at 00:00 UTC unless their `period` says otherwise.

#### `@sdxc/cloudflare-pricing/workers`

`REQUESTS`, `CPU_MS` and `LOG_EVENTS_WRITTEN` (Workers Logs), on the Standard usage model.

#### `@sdxc/cloudflare-pricing/durable-objects`

`REQUESTS`, `DURATION` (GB-s), `SQLITE_ROWS_READ`, `SQLITE_ROWS_WRITTEN` and `SQLITE_STORAGE`, for the SQLite storage backend. `BILLED_MEMORY_GB` is `0.128`: every object bills for 128 MB, which Cloudflare's own examples count as 0.128 GB. `centsPerActiveMs()` combines the two into the price of one millisecond an object stays active.

```typescript
DurableObjects.centsPerActiveMs(); // 0.00000016
// same as
(((12.5 * 100) / 1_000_000) * 0.128) / 1000;
```

#### `@sdxc/cloudflare-pricing/d1`

`ROWS_READ`, `ROWS_WRITTEN` and `STORAGE`. A written row costs 1,000 times a read one, so meter them separately.

#### `@sdxc/cloudflare-pricing/kv`

`READS`, `WRITES`, `DELETES`, `LISTS` and `STORAGE`, each operation counted per key.

#### `@sdxc/cloudflare-pricing/queues`

`OPERATIONS`: one per 64 KB of each message written, read or deleted — usually three per delivered message, plus a read per retry.

#### `@sdxc/cloudflare-pricing/analytics-engine`

`DATA_POINTS_WRITTEN` and `READ_QUERIES`. `BILLING_ACTIVE` is `false`: Cloudflare publishes these prices ahead of invoicing them.

#### `@sdxc/cloudflare-pricing/email-service`

`EMAILS_SENT`, outbound sends through the `send_email` binding. Sending to arbitrary recipients requires Workers Paid, so `freeLimit` is `null`; sends to verified destination addresses are free on every plan.

#### `@sdxc/cloudflare-pricing/r2`

`STORAGE`, `CLASS_A_OPERATIONS` and `CLASS_B_OPERATIONS` for Standard storage, whose `included` is R2's free tier on every account; and `INFREQUENT_ACCESS_STORAGE`, `INFREQUENT_ACCESS_CLASS_A_OPERATIONS`, `INFREQUENT_ACCESS_CLASS_B_OPERATIONS` and `INFREQUENT_ACCESS_DATA_RETRIEVAL`, which have no free tier.

## Pattern: A Rate Card For A Cost Ledger

Derive every rate once, at the boundary where measured quantities meet money, and store quantities rather than cents so a corrected price can re-price history.

```typescript
import { centsPerGbDay, centsPerUnit } from "@sdxc/cloudflare-pricing";
import * as D1 from "@sdxc/cloudflare-pricing/d1";
import * as DurableObjects from "@sdxc/cloudflare-pricing/durable-objects";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

const RATES = {
	workerRequests: centsPerUnit(Workers.REQUESTS),
	workerCpuMs: centsPerUnit(Workers.CPU_MS),
	objectActiveMs: DurableObjects.centsPerActiveMs(),
	d1RowsRead: centsPerUnit(D1.ROWS_READ),
	d1RowsWritten: centsPerUnit(D1.ROWS_WRITTEN),
	d1StorageGbDays: centsPerGbDay(D1.STORAGE),
};

type Quantities = Record<keyof typeof RATES, number>;

function priceCents(quantities: Quantities) {
	let cents = 0;
	for (let key of Object.keys(RATES) as (keyof typeof RATES)[]) {
		cents += quantities[key] * RATES[key];
	}
	return cents;
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

overageCents(KV.READS, 25_000_000); // 750 — 15 million reads past the 10 million included
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export, and any release may change a price.

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
