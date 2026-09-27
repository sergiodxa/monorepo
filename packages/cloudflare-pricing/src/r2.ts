/**
 * R2 prices for the Standard and Infrequent Access storage classes: storage, Class A and
 * Class B operations, and Infrequent Access retrieval. Egress and deletes are free.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/r2/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL = "https://developers.cloudflare.com/r2/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/**
 * Standard storage, averaged from each day's peak over a 30-day period. `included` is R2's
 * free tier, which every account gets whatever its Workers plan.
 */
export const STORAGE: Meter<"GB-month"> = {
	unit: "GB-month",
	price: { usd: 0.015, per: 1 },
	included: { quantity: 10, period: "month" },
	freeLimit: null,
};

/** Standard Class A operations — the mutating ones: `PutObject`, `ListObjects`, uploads, copies. */
export const CLASS_A_OPERATIONS: Meter<"Class A operation"> = {
	unit: "Class A operation",
	price: { usd: 4.5, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: null,
};

/** Standard Class B operations — the reading ones: `GetObject`, `HeadObject`, `HeadBucket`. */
export const CLASS_B_OPERATIONS: Meter<"Class B operation"> = {
	unit: "Class B operation",
	price: { usd: 0.36, per: 1_000_000 },
	included: { quantity: 10_000_000, period: "month" },
	freeLimit: null,
};

/** Infrequent Access storage, billed for at least 30 days per object. */
export const INFREQUENT_ACCESS_STORAGE: Meter<"GB-month"> = {
	unit: "GB-month",
	price: { usd: 0.01, per: 1 },
	included: null,
	freeLimit: null,
};

/** Class A operations on Infrequent Access objects; R2's free tier covers Standard only. */
export const INFREQUENT_ACCESS_CLASS_A_OPERATIONS: Meter<"Class A operation"> = {
	unit: "Class A operation",
	price: { usd: 9, per: 1_000_000 },
	included: null,
	freeLimit: null,
};

/** Class B operations on Infrequent Access objects; R2's free tier covers Standard only. */
export const INFREQUENT_ACCESS_CLASS_B_OPERATIONS: Meter<"Class B operation"> = {
	unit: "Class B operation",
	price: { usd: 0.9, per: 1_000_000 },
	included: null,
	freeLimit: null,
};

/** Data read or copied out of Infrequent Access storage. */
export const INFREQUENT_ACCESS_DATA_RETRIEVAL: Meter<"GB retrieved"> = {
	unit: "GB retrieved",
	price: { usd: 0.01, per: 1 },
	included: null,
	freeLimit: null,
};
