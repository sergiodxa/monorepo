/**
 * Publishes the sponsors the footer names onto the request context, read from the
 * site's own cache. The request path only reads: the list is put there by the
 * scheduled refresh, so a page never waits on GitHub and an outage there costs a
 * reader nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import type { Sponsor } from "~/app/services/sponsors";

import { siteCache } from "~/app/services/cache";
import { readStoredSponsors } from "~/app/services/sponsors";

/**
 * The published list, reachable from a handler as `ctx.sponsors`. It defaults to
 * nobody, so a surface reached before the middleware has run draws no block rather
 * than failing to find one.
 */
export const SponsorList: ReturnType<typeof createContextKey<Sponsor[]>> = createContextKey<
	Sponsor[]
>([]);

/**
 * Builds the middleware that publishes the sponsors.
 *
 * @returns The middleware, for the router's global chain.
 */
export function sponsors(): Middleware {
	return async (ctx, next) => {
		let list = await readStoredSponsors(siteCache());
		ctx.set(SponsorList, list, { property: "sponsors" });
		return next();
	};
}

/**
 * Names one version of the sponsor list, so a stored copy of a page retires when the
 * people it names change.
 *
 * @param list - The sponsors a page was rendered with.
 * @returns A short string standing for that list.
 */
export function sponsorsTag(list: Sponsor[]): string {
	return list.map((sponsor) => sponsor.login).join(",");
}
