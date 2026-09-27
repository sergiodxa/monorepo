/**
 * Workers KV prices: keys read, written and deleted, list requests, and stored data. Every
 * operation bills per key, so a bulk read of 10 keys is 10 reads.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/kv/platform/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL = "https://developers.cloudflare.com/kv/platform/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/** Keys read, counting each key of a bulk read separately. */
export const READS: Meter<"key read"> = {
	unit: "key read",
	price: { usd: 0.5, per: 1_000_000 },
	included: { quantity: 10_000_000, period: "month" },
	freeLimit: { quantity: 100_000, period: "day" },
};

/** Keys written, from a Worker `put()` or each pair of a REST bulk write. */
export const WRITES: Meter<"key written"> = {
	unit: "key written",
	price: { usd: 5, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: { quantity: 1_000, period: "day" },
};

/** Keys deleted, priced the same as a write. */
export const DELETES: Meter<"key deleted"> = {
	unit: "key deleted",
	price: { usd: 5, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: { quantity: 1_000, period: "day" },
};

/** `list()` requests, one per call whatever it returns. */
export const LISTS: Meter<"list request"> = {
	unit: "list request",
	price: { usd: 5, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: { quantity: 1_000, period: "day" },
};

/** Stored keys and values across the account. */
export const STORAGE: Meter<"GB-month"> = {
	unit: "GB-month",
	price: { usd: 0.5, per: 1 },
	included: { quantity: 1, period: "month" },
	freeLimit: { quantity: 1, period: "total" },
};
