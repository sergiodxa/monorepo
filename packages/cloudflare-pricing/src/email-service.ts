/**
 * Cloudflare Email Service prices for outbound sending through the `send_email` binding.
 * Inbound Email Routing is unlimited on every plan, and the Workers it runs bill as Workers.
 * Transcribed on 2026-09-27 from https://developers.cloudflare.com/email-service/platform/pricing/
 * (Cloudflare docs, CC BY 4.0); {@link PRICES_VERIFIED_ON} says how to refresh it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Meter } from "./meter.js";

/** The official page every price in this module is transcribed from. */
export const PRICING_DOCS_URL = "https://developers.cloudflare.com/email-service/platform/pricing/";

/**
 * The day these prices were last compared against {@link PRICING_DOCS_URL}. To refresh, open
 * that URL with `index.md` appended, copy each meter's Workers Paid price, included and Free
 * quantities as printed, set this date, and update the per-unit figures in the service tests.
 */
export const PRICES_VERIFIED_ON = "2026-09-27";

/**
 * Emails accepted for sending to arbitrary recipients, hard bounces included; sends to the
 * account's verified destination addresses are free. Sending requires Workers Paid.
 */
export const EMAILS_SENT: Meter<"email"> = {
	unit: "email",
	price: { usd: 0.35, per: 1_000 },
	included: { quantity: 3_000, period: "month" },
	freeLimit: null,
};
