/**
 * Flattens touches for the places attribution leaves the app: a billing checkout's metadata bag,
 * which the provider hands back on its orders and webhooks, and the `utm_*` fields a newsletter
 * or CRM provider stores beside a subscriber.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Attribution, Touch, Utm } from "./types.js";

import { CAMPAIGN_PARAMETERS } from "./parameters.js";

/**
 * The first and last touch as snake_case keys prefixed `first_` and `last_`, holding only the
 * fields present: `channel`, `landing`, `at` (ISO 8601), `referrer`, `click` and the UTM fields.
 * At most 28 keys of under 300 characters each, inside Polar's and Stripe's metadata limits.
 *
 * @example checkouts.create({ product, metadata: toMetadata(ctx.attribution) })
 */
export function toMetadata(
	attribution: Pick<Attribution, "first" | "last">,
): Record<string, string> {
	return {
		...touchMetadata("first", attribution.first),
		...touchMetadata("last", attribution.last),
	};
}

/**
 * The touch's campaign fields under their `utm_*` names, `{}` for a `null` touch.
 *
 * @example toUtmParams(ctx.attribution.last ?? ctx.attribution.first) // { utm_source: "newsletter" }
 */
export function toUtmParams(touch: Touch | null): Record<string, string> {
	let params: Record<string, string> = {};
	if (!touch?.utm) return params;
	for (let field of Object.keys(CAMPAIGN_PARAMETERS) as (keyof Utm)[]) {
		let value = touch.utm[field];
		if (value !== undefined) params[CAMPAIGN_PARAMETERS[field]] = value;
	}
	return params;
}

/**
 * One touch's keys under a prefix. A kept click identifier is written `param=value`, which is
 * what an offline-conversion upload needs; otherwise `click` names the network.
 */
function touchMetadata(prefix: "first" | "last", touch: Touch | null): Record<string, string> {
	if (!touch) return {};
	let metadata: Record<string, string> = {
		[`${prefix}_channel`]: touch.channel,
		[`${prefix}_landing`]: touch.landingPath,
		[`${prefix}_at`]: new Date(touch.at).toISOString(),
	};
	if (touch.referrer) metadata[`${prefix}_referrer`] = touch.referrer.host;
	if (touch.click) {
		metadata[`${prefix}_click`] =
			touch.click.value === undefined
				? touch.click.network
				: `${touch.click.param}=${touch.click.value}`;
	}
	for (let [name, value] of Object.entries(toUtmParams(touch))) {
		metadata[`${prefix}_${name.slice("utm_".length)}`] = value;
	}
	return metadata;
}
