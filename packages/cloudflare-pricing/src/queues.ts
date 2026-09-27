/**
 * Cloudflare Queues prices: standard operations, the one dimension Queues bills. Delivering
 * a message usually takes three — a write, a read and a delete — plus a read per retry.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/queues/platform/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL = "https://developers.cloudflare.com/queues/platform/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/**
 * Operations: one per 64 KB (of 1,000 bytes, including ~100 bytes of metadata) of each
 * message written, read or deleted, counted per message rather than per batch.
 */
export const OPERATIONS: Meter<"operation"> = {
	unit: "operation",
	price: { usd: 0.4, per: 1_000_000 },
	included: { quantity: 1_000_000, period: "month" },
	freeLimit: { quantity: 10_000, period: "day" },
};
