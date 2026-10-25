/**
 * The billing platform this app sells through, configured once. Every Polar identifier the
 * app knows is in this file: call sites name a product and a meter by our own slug, so the
 * vendor appears in one import and one construction here rather than in every controller
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

/** Our own name for the subscription a paying team's owner holds, and the only thing sold. */
export const MONITORING_PRODUCT = "monitoring";

/**
 * Our own name for the meter every performed check is counted against, and the event name
 * the meter matches on — the two have to stay the same string, since a mismatch between
 * them once left every team's usage silently reading zero.
 */
export const PING_METER = "ping";

/**
 * Our own name for the meter one browser flow run is counted against, and the event name
 * the meter matches on. HTTP-only flows stay on {@link PING_METER}; browser flows use this
 * one instead.
 */
export const FLOW_RUN_METER = "flow_run";

/**
 * The billing platform, reached through the vendor-neutral contract. The credentials are
 * functions so the first call that needs one resolves it, keeping module evaluation free
 * of any environment read.
 */
export const polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET,
	products: { [MONITORING_PRODUCT]: "94161883-14eb-42e2-bb26-b4647199cda1" },
	meters: {
		[PING_METER]: "22fabd9b-8b03-4cc2-8981-230717267cd5",
		[FLOW_RUN_METER]: "7e7448c7-41de-4976-8432-c829efec0d67",
	},
});
