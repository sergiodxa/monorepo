/**
 * The platform's billing platform: one `PolarBilling` built at module scope, so the
 * dashboard reaches it through `context.billing` and the reporting job imports it,
 * and the Polar product id lives here rather than at any call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

/** Our own name for the platform subscription every account buys. */
export const PRO_PRODUCT = "pro";

/** Our own name for the meter the reporting job counts page views against. */
export const PAGE_VIEWS_METER = "page_views";

/**
 * The configured Polar organization. The credentials resolve on first use, so
 * importing this module reads no secret, and an unset signing secret leaves a
 * delivery unproven instead of failing the endpoint.
 */
export const polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET ?? "",
	products: { [PRO_PRODUCT]: env.POLAR_PRODUCT_ID },
});
