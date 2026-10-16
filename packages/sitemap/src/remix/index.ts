/**
 * Builds a sitemap from a Remix route table, requiring a decision for every route a crawler can
 * request: a page added to the table fails typechecking until its sitemap lists or excludes it,
 * and the params a listed page needs are typed from its pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreateHrefArgs } from "remix/route-pattern/href";
import type { Route, RouteMap } from "remix/routes";

import { Sitemap } from "../index.js";

/** The methods a crawler's `GET` reaches, so only these routes take a decision. */
type Crawlable = "GET" | "ANY";

/**
 * Whether a route, or any route inside a map, answers a crawler; a map holding only `POST` and
 * other write routes needs no key.
 */
type Decidable<value> =
	value extends Route<infer method, string>
		? method extends Crawlable
			? true
			: false
		: value extends RouteMap
			? string extends keyof value
				? true
				: true extends Decidable<value[keyof value]>
					? true
					: false
			: false;

/** The params `href()` takes for a pattern, with optional groups such as `(.:ext)` optional. */
type HrefParams<pattern extends string> = NonNullable<CreateHrefArgs<pattern>[0]>;

/** Mirrors a route table with one decision per crawlable route or map of them. */
export type Decisions<map extends RouteMap> = {
	[name in keyof map as Decidable<map[name]> extends true ? name : never]: Decision<map[name]>;
};

/**
 * What one key accepts. A route without required params takes `true` or the entry's options; a
 * route with params takes the list of pages to write; a map takes its own decisions; `false`
 * excludes the route or the whole map. A pattern `href()` cannot build alone takes only `false`.
 */
export type Decision<value> =
	value extends Route<infer _method, infer pattern>
		? [CreateHrefArgs<pattern>] extends [never]
			? false
			: undefined extends CreateHrefArgs<pattern>[0]
				? boolean | Sitemap.AppendOptions
				: false | Page<HrefParams<pattern>>[]
		: value extends RouteMap
			? false | Decisions<value>
			: never;

/**
 * One page of a route with params: the params `href()` builds its URL from, plus the crawler
 * metadata `Sitemap.append` writes for it.
 *
 * @template params The params the route's pattern declares
 */
export interface Page<params> extends Sitemap.AppendOptions {
	params: params;
}

/**
 * Lists a route table's pages in table order, each URL built by its route's `href()` and
 * resolved against `origin`; a route whose pattern names a hostname keeps its own.
 *
 * @param routes - The route table, as `route()` from `remix/routes` returns it
 * @param origin - The site's origin, usually the request URL
 * @param decisions - A decision for every `GET` and `ANY` route in the table
 * @returns The sitemap, ready for `toString()`
 * @example fromRoutes(routes, ctx.url, { home: { priority: 1 }, healthcheck: false })
 */
export function fromRoutes<map extends RouteMap>(
	routes: map,
	origin: URL | string,
	decisions: NoInfer<Decisions<map>>,
): Sitemap {
	let sitemap = new Sitemap();
	appendMap(sitemap, routes, decisions as Record<string, unknown>, origin);
	return sitemap;
}

/**
 * Walks one level of the table in its declared order, so the document lists pages in the order
 * the app declares its routes; a key the decisions leave out is a route the types never asked
 * about, such as a `POST`.
 */
function appendMap(
	sitemap: Sitemap,
	map: RouteMap,
	decisions: Record<string, unknown>,
	origin: URL | string,
) {
	for (let [name, value] of Object.entries(map)) {
		let decision = decisions[name];
		if (decision === undefined || decision === false) continue;

		if (!isRoute(value)) {
			appendMap(sitemap, value, decision as Record<string, unknown>, origin);
			continue;
		}

		if (value.method !== "GET" && value.method !== "ANY") continue;
		appendRoute(sitemap, value, decision, origin);
	}
}

/**
 * Writes one route's pages: a list builds a URL per page from its params, and `true` or an
 * options object writes the route's own URL once.
 */
function appendRoute(sitemap: Sitemap, route: Route, decision: unknown, origin: URL | string) {
	let target = route as unknown as { href(params?: Record<string, unknown>): string };

	if (Array.isArray(decision)) {
		for (let { params, ...options } of decision as Page<Record<string, unknown>>[]) {
			sitemap.append(new URL(target.href(params), origin), options);
		}
		return;
	}

	let options = decision === true ? {} : (decision as Sitemap.AppendOptions);
	sitemap.append(new URL(target.href(), origin), options);
}

/**
 * Tells a route from a nested map by its shape, so a table built by any installed copy of
 * `remix/routes` reads the same.
 */
function isRoute(value: Route | RouteMap): value is Route {
	return typeof value.href === "function" && "method" in value && "pattern" in value;
}
