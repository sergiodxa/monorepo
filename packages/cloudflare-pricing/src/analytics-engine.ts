/**
 * Workers Analytics Engine prices: data points written and SQL API read queries. Cloudflare
 * publishes them ahead of billing, which {@link BILLING_ACTIVE} records.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/analytics/analytics-engine/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL =
	"https://developers.cloudflare.com/analytics/analytics-engine/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/**
 * Whether Cloudflare currently invoices Analytics Engine usage. `false` means the prices
 * below are the announced ones: a ledger can meter against them, while the invoice shows zero.
 */
export const BILLING_ACTIVE = false;

/** `writeDataPoint()` calls, each priced the same whatever its size or cardinality. */
export const DATA_POINTS_WRITTEN: Meter<"data point"> = {
	unit: "data point",
	price: { usd: 0.25, per: 1_000_000 },
	included: { quantity: 10_000_000, period: "month" },
	freeLimit: { quantity: 100_000, period: "day" },
};

/** Posts to the SQL API, each priced the same whatever it reads. */
export const READ_QUERIES: Meter<"read query"> = {
	unit: "read query",
	price: { usd: 1, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: { quantity: 10_000, period: "day" },
};
