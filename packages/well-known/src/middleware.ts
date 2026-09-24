/**
 * A fetch-router middleware that answers the well-known names an app lists and passes
 * every other path on, so the registry composes with the app's own routes, including
 * app-specific names under `/.well-known/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware, RequestContext } from "remix/router";

import type { WellKnownFormat } from "./format.js";
import type { RespondOptions } from "./response.js";

import { respond } from "./response.js";

/** What one name answers with; `null` falls through to the next middleware, usually a 404. */
export type WellKnownEntry = (ctx: RequestContext) => Response | null | Promise<Response | null>;

/** The path prefix RFC 8615 reserves. */
const PREFIX = "/.well-known/";

/** The methods every name answers. */
const READ_METHODS = ["GET", "HEAD"];

/**
 * What the middleware knows about an entry `serve` built: whether its format inserts
 * the suffix (so a path may follow the name) and whether it answers CORS preflights.
 */
const ENTRY_FORMATS = new WeakMap<
	WellKnownEntry,
	Pick<WellKnownFormat<unknown>, "placement" | "cors">
>();

/**
 * Serves a format's document, produced per request so tenant or clock data can vary.
 * A `null` document falls through to the next middleware.
 *
 * @param format - The document's format.
 * @param produce - Builds the document for the request.
 * @param options - The cache policy and extra headers.
 * @template Document - The format's document type.
 * @example
 * serve(securityTxt, () => SECURITY_TXT);
 */
export function serve<Document>(
	format: WellKnownFormat<Document>,
	produce: (ctx: RequestContext) => Document | null | Promise<Document | null>,
	options: Omit<RespondOptions, "request"> = {},
): WellKnownEntry {
	let entry: WellKnownEntry = async (ctx) => {
		let document = await produce(ctx);
		if (document === null) return null;
		return await respond(format, document, { ...options, request: ctx.request });
	};
	ENTRY_FORMATS.set(entry, { placement: format.placement, cors: format.cors });
	return entry;
}

/**
 * The entry a path names: the exact name, or, for a format that inserts its suffix
 * before an identifier's path, the name followed by that path.
 *
 * @param entries - The names the app serves.
 * @param suffix - The path after `/.well-known/`.
 */
function findEntry(entries: Record<string, WellKnownEntry>, suffix: string): WellKnownEntry | null {
	for (let [name, entry] of Object.entries(entries)) {
		if (suffix === name) return entry;
		if (suffix.startsWith(`${name}/`) && ENTRY_FORMATS.get(entry)?.placement === "insert")
			return entry;
	}
	return null;
}

/**
 * Answers `GET` and `HEAD` on `/.well-known/<name>` (and `/.well-known/<name>/<path>` for an
 * inserted name) for the names given, `OPTIONS` for a CORS format, and a 405 with `Allow`
 * for any other method. Every other path goes to `next()`.
 *
 * @param entries - Each name the app serves, mapped to what answers it.
 * @example
 * wellKnown({ "security.txt": serve(securityTxt, () => SECURITY_TXT) });
 */
export function wellKnown(entries: Record<string, WellKnownEntry>): Middleware {
	return async (ctx, next) => {
		let path = ctx.url.pathname;
		if (!path.startsWith(PREFIX)) return next();

		let entry = findEntry(entries, path.slice(PREFIX.length));
		if (entry === null) return next();

		let cors = ENTRY_FORMATS.get(entry)?.cors ?? false;
		let allow = cors ? [...READ_METHODS, "OPTIONS"] : READ_METHODS;
		let method = ctx.method.toUpperCase();

		if (method === "OPTIONS" && cors) {
			return new Response(null, {
				status: 204,
				headers: {
					Allow: allow.join(", "),
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": allow.join(", "),
				},
			});
		}
		if (!READ_METHODS.includes(method)) {
			return new Response(null, { status: 405, headers: { Allow: allow.join(", ") } });
		}

		let response = await entry(ctx);
		if (response === null) return next();
		if (method === "HEAD" && response.body !== null) return new Response(null, response);
		return response;
	};
}
