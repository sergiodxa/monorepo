/**
 * Durable Objects prices for the SQLite storage backend: requests, wall-clock duration,
 * SQLite rows read and written, and SQLite storage.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/durable-objects/platform/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

import { centsPerUnit } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL =
	"https://developers.cloudflare.com/durable-objects/platform/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/**
 * Requests: HTTP requests, RPC sessions (one per stub method call), alarm invocations, and
 * incoming WebSocket messages at a 20:1 ratio.
 */
export const REQUESTS: Meter<"request"> = {
	unit: "request",
	price: { usd: 0.15, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: { quantity: 100_000, period: "day" },
};

/**
 * Wall-clock duration while an object is active and not eligible to hibernate, billed on
 * {@link BILLED_MEMORY_GB} whatever the object actually uses.
 */
export const DURATION: Meter<"GB-s"> = {
	unit: "GB-s",
	price: { usd: 12.5, per: 1_000_000 },
	included: { quantity: 400_000, period: "month" },
	freeLimit: { quantity: 13_000, period: "day" },
};

/**
 * The memory every object is billed for, in GB. Cloudflare's own examples compute GB-s as
 * `seconds × 128 MB / 1 GB`, so 128 MB counts as 0.128 GB.
 */
export const BILLED_MEMORY_GB = 0.128;

/** SQLite rows read, including the hidden table behind the key-value `get()`/`list()` methods. */
export const SQLITE_ROWS_READ: Meter<"row read"> = {
	unit: "row read",
	price: { usd: 0.001, per: 1_000_000 },
	included: { quantity: 25_000_000_000, period: "month" },
	freeLimit: { quantity: 5_000_000, period: "day" },
};

/** SQLite rows written; deletes, key-value `put()`/`delete()` and each `setAlarm()` count too. */
export const SQLITE_ROWS_WRITTEN: Meter<"row written"> = {
	unit: "row written",
	price: { usd: 1, per: 1_000_000 },
	included: { quantity: 50_000_000, period: "month" },
	freeLimit: { quantity: 100_000, period: "day" },
};

/** SQLite stored data, billed until the object's storage is removed. */
export const SQLITE_STORAGE: Meter<"GB-month"> = {
	unit: "GB-month",
	price: { usd: 0.2, per: 1 },
	included: { quantity: 5, period: "month" },
	freeLimit: { quantity: 5, period: "total" },
};

/**
 * The price of one millisecond an object stays active, in cents: {@link DURATION}'s GB-s
 * price at {@link BILLED_MEMORY_GB}, so a ledger meters duration in the milliseconds it
 * measures.
 *
 * @returns Cents per active millisecond of one object.
 */
export function centsPerActiveMs(): number {
	return (centsPerUnit(DURATION) * BILLED_MEMORY_GB) / 1000;
}
