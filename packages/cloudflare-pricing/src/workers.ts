/**
 * Workers Standard usage-model prices: inbound requests, CPU time and Workers Logs events.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/workers/platform/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL = "https://developers.cloudflare.com/workers/platform/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/**
 * Inbound requests. Subrequests, static asset requests and service-binding calls are free;
 * the Free plan's 100,000 a day is shared with Workflows.
 */
export const REQUESTS: Meter<"request"> = {
	unit: "request",
	price: { usd: 0.3, per: 1_000_000 },
	included: { quantity: 10_000_000, period: "month" },
	freeLimit: { quantity: 100_000, period: "day" },
};

/** CPU milliseconds; wall-clock duration is free. The Free plan caps each invocation at 10 ms. */
export const CPU_MS: Meter<"CPU ms"> = {
	unit: "CPU ms",
	price: { usd: 0.02, per: 1_000_000 },
	included: { quantity: 30_000_000, period: "month" },
	freeLimit: { quantity: 10, period: "invocation" },
};

/** Workers Logs events written, billed once a Worker enables observability. */
export const LOG_EVENTS_WRITTEN: Meter<"log event"> = {
	unit: "log event",
	price: { usd: 0.6, per: 1_000_000 },
	included: { quantity: 20_000_000, period: "month" },
	freeLimit: { quantity: 200_000, period: "day" },
};
