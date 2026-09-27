/**
 * D1 prices: rows read, rows written and storage, the three dimensions D1 bills.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/d1/platform/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL = "https://developers.cloudflare.com/d1/platform/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/** Rows a query scans, whatever it returns — the `meta.rows_read` of a D1 result. */
export const ROWS_READ: Meter<"row read"> = {
	unit: "row read",
	price: { usd: 0.001, per: 1_000_000 },
	included: { quantity: 25_000_000_000, period: "month" },
	freeLimit: { quantity: 5_000_000, period: "day" },
};

/** Rows inserted, updated or deleted, plus one per index touched — `meta.rows_written`. */
export const ROWS_WRITTEN: Meter<"row written"> = {
	unit: "row written",
	price: { usd: 1, per: 1_000_000 },
	included: { quantity: 50_000_000, period: "month" },
	freeLimit: { quantity: 100_000, period: "day" },
};

/** Tables and indexes stored, summed across every database in the account. */
export const STORAGE: Meter<"GB-month"> = {
	unit: "GB-month",
	price: { usd: 0.75, per: 1 },
	included: { quantity: 5, period: "month" },
	freeLimit: { quantity: 5, period: "total" },
};
