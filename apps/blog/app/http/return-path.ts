/**
 * The page a login returns to, at each hop it travels: written onto the login URL a
 * guarded CMS page redirects to, read back from that URL, and checked again before the
 * signed-in redirect, so every hop applies the one rule `ReturnPathSchema` states.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { parseSafe } from "remix/data-schema";

import { LoginQuerySchema, ReturnPathSchema } from "~/app/schemas/auth";
import routes from "~/routes/web";

/**
 * Checks a destination from any source, such as the one a login transaction stored or the
 * one held in the session, against the return-path rule.
 *
 * @param value The candidate destination.
 * @returns The resolved path, or `null` for anything naming a place off this site.
 * @example let destination = parseReturnPath(grant.returnTo) ?? routes.cms.dashboard.href();
 */
export function parseReturnPath(value: unknown): string | null {
	let result = parseSafe(ReturnPathSchema, value);
	return result.success ? result.value : null;
}

/**
 * The page a login URL asks to come back to, from its `next` query parameter.
 *
 * @param url The login request's URL.
 * @returns The resolved path, or `null` when `next` is absent, repeated, or off this site.
 */
export async function requestedReturnPath(url: URL): Promise<string | null> {
	let query = await validate(url.searchParams, LoginQuerySchema);
	if (isFailure(query)) return null;
	return query.data.next ?? null;
}

/**
 * The login page for a request that needs a session, carrying the request's path and
 * query as `next`. A `GET` names the page to come back to; any other method names an
 * action, so its login lands on the default destination.
 *
 * @param request The request being sent to log in.
 * @returns The login href, with `next` when the request names a page.
 * @example return redirect(loginFor(ctx), { status: redirect.Status.SeeOther });
 */
export function loginFor(request: Pick<RequestContext, "method" | "url">): string {
	let next =
		request.method === "GET" ? parseReturnPath(request.url.pathname + request.url.search) : null;
	return routes.auth.login.index.href(null, { searchParams: { next } });
}
