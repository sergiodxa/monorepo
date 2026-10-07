/**
 * Router middleware that keeps a visitor's first and last touch in the session or in a cookie and
 * publishes them, with the request's own touch, as `ctx.attribution`. A form action or checkout
 * on the same origin reads where the visitor came from without the page carrying hidden fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Cookie } from "remix/cookie";
import type { Schema } from "remix/data-schema";
import type { Middleware, RequestContext } from "remix/router";

import { toMs } from "@sdxc/duration";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { isBot } from "@sdxc/user-agent";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { Session } from "remix/session";

import type { ReadTouchOptions } from "./touch.js";
import type { Attribution, Touch } from "./types.js";

import { isTrackingParameter, withoutTracking } from "./parameters.js";
import { readTouch } from "./touch.js";

/**
 * Declared in an imported module, so a project types `ctx.attribution` by importing this
 * middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** How this visitor arrived: this request's touch, and the stored first and last. */
		attribution: Attribution;
	}
}

/**
 * The request's attribution, for code that reads it by key rather than `ctx.attribution`. The
 * type is written out because an exported key needs a nameable type to reach a declaration file.
 */
export const CurrentAttribution: { defaultValue: Attribution } = createContextKey<Attribution>({
	current: null,
	first: null,
	last: null,
});

/** Options for {@link attribution}. */
export interface AttributionOptions extends Omit<ReadTouchOptions, "referrer" | "now"> {
	/**
	 * `"session"` keeps the record under the `attribution` key of `remix/session`'s session, which
	 * its middleware commits; a `Cookie` holds the record as its value. Sign the cookie, so a
	 * visitor cannot forge a campaign.
	 */
	store: "session" | Cookie;
	/**
	 * How long a first touch stands. A visit after this window replaces it, so a visitor who
	 * returns a year later from a new campaign is credited to that campaign.
	 *
	 * @default "90 days"
	 */
	window?: DurationInput;
	/**
	 * Whether this visitor allows attribution to be stored. Without it, the request still reads
	 * its own touch as `current`, and any stored record is removed.
	 *
	 * @default (ctx) => ctx.request.headers.get("sec-gpc") !== "1"
	 */
	consent?: (ctx: RequestContext) => boolean;
	/**
	 * Answers a page request that carries tracking parameters with a `302` to the same URL without
	 * them, once the touch is stored.
	 *
	 * @default false
	 */
	redirect?: boolean;
}

/** The session key the record lives under. */
const SESSION_KEY = "attribution";

/** What the store holds: the two touches that outlive a request. */
interface StoredRecord {
	first: Touch | null;
	last: Touch | null;
}

/** A slug field of a stored `Utm`, absent when the link did not carry it. */
const SLUG_SCHEMA = s.optional(s.string());

/** A stored touch, read back from a cookie a visitor could have edited. */
const TOUCH_SCHEMA: Schema<unknown, Touch> = s.object({
	at: s.number(),
	landingPath: s.string(),
	utm: s.nullable(
		s.object({
			source: SLUG_SCHEMA,
			medium: SLUG_SCHEMA,
			campaign: SLUG_SCHEMA,
			term: SLUG_SCHEMA,
			content: SLUG_SCHEMA,
			id: SLUG_SCHEMA,
			sourcePlatform: SLUG_SCHEMA,
			creativeFormat: SLUG_SCHEMA,
			marketingTactic: SLUG_SCHEMA,
		}),
	),
	click: s.nullable(
		s.object({
			param: s.string(),
			network: s.string(),
			paid: s.boolean(),
			value: s.optional(s.string()),
		}),
	),
	referrer: s.nullable(
		s.object({ host: s.string(), kind: s.enum_(["search", "social", "email", "other"]) }),
	),
	channel: s.enum_([
		"direct",
		"organic-search",
		"paid-search",
		"organic-social",
		"paid-social",
		"email",
		"display",
		"affiliate",
		"referral",
		"other",
	]),
});

/** The stored record, which reads as no record when any part of it does not match. */
const RECORD_SCHEMA: Schema<unknown, StoredRecord> = s.object({
	first: s.nullable(TOUCH_SCHEMA),
	last: s.nullable(TOUCH_SCHEMA),
});

/** The empty record a visitor without a stored one starts from. */
const NO_RECORD: StoredRecord = { first: null, last: null };

/** Global Privacy Control: a visitor who sends `Sec-GPC: 1` has opted out of tracking. */
function honorsGlobalPrivacyControl(ctx: RequestContext): boolean {
	return ctx.request.headers.get("sec-gpc") !== "1";
}

/**
 * Creates a middleware that publishes `ctx.attribution` on every request and, on a page
 * navigation from a visitor who consents, records the first touch within `window` and the latest
 * non-direct one. A bot, a non-navigation request and a direct revisit write nothing.
 *
 * @example createRouter({ middleware: [session, attribution({ store: "session" })] })
 * @example createRouter({ middleware: [attribution({ store: ATTRIBUTION_COOKIE, redirect: true })] })
 */
export function attribution(options: AttributionOptions): Middleware {
	let windowMs = toMs(options.window ?? "90 days");
	let consent = options.consent ?? honorsGlobalPrivacyControl;
	let store = options.store;

	return async (ctx, next) => {
		let stored = await readRecord(ctx, store);
		let publish = (value: Attribution) =>
			ctx.set(CurrentAttribution, value, { property: "attribution" });

		if (!isNavigation(ctx.request)) {
			publish({ current: null, ...stored });
			return next();
		}

		let cookie: string | null = null;
		if (isBot(ctx.request.headers.get("user-agent") ?? "")) {
			publish({ current: null, ...stored });
		} else {
			let current = readTouch(ctx.url, {
				referrer: ctx.request.headers.get("referer"),
				aliases: options.aliases,
				clickIds: options.clickIds,
				referrers: options.referrers,
			});

			if (!consent(ctx)) {
				publish({ current, first: null, last: null });
				cookie = await clearRecord(ctx, store);
			} else {
				let advanced = advance(stored, current, windowMs);
				publish({ current, ...advanced });
				if (advanced !== stored) {
					cookie = await writeRecord(ctx, store, advanced);
					currentLog()?.set({
						attribution: {
							channel: current.channel,
							source: current.utm?.source,
							campaign: current.utm?.campaign,
						},
					});
				}
			}
		}

		let response =
			options.redirect && hasTrackingParameters(ctx.url)
				? new Response(null, {
						status: 302,
						headers: { Location: withoutTracking(ctx.url).toString(), "Cache-Control": "no-store" },
					})
				: await next();

		return cookie === null ? response : withCookie(response, cookie);
	};
}

/**
 * Whether the request is a browser loading a page: a `GET` whose `Sec-Fetch-Dest` is `document`,
 * or, from a browser that omits that header, whose `Accept` names `text/html`. A `HEAD` probe
 * renders nothing a visitor sees, so it records nothing.
 */
function isNavigation(request: Request): boolean {
	if (request.method !== "GET") return false;
	let dest = request.headers.get("sec-fetch-dest");
	if (dest !== null) return dest === "document";
	return (request.headers.get("accept") ?? "").includes("text/html");
}

/** Whether the URL carries any parameter the redirect would remove. */
function hasTrackingParameters(url: URL): boolean {
	return [...url.searchParams.keys()].some(isTrackingParameter);
}

/**
 * The record after this touch: a first touch when there is none or the stored one is older than
 * the window, and a last touch whenever this one is not direct. Answers `stored` itself when
 * neither changes, so a direct revisit writes nothing.
 */
function advance(stored: StoredRecord, current: Touch, windowMs: number): StoredRecord {
	let firstExpired = stored.first === null || current.at - stored.first.at > windowMs;
	let replacesLast = current.channel !== "direct";
	if (!firstExpired && !replacesLast) return stored;
	return {
		first: firstExpired ? current : stored.first,
		last: replacesLast ? current : stored.last,
	};
}

/** The stored record, or the empty one when the store holds nothing that matches the schema. */
async function readRecord(ctx: RequestContext, store: "session" | Cookie): Promise<StoredRecord> {
	let raw: unknown;
	if (store === "session") {
		raw = sessionOf(ctx)?.get(SESSION_KEY);
	} else {
		let value = await store.parse(ctx.request.headers.get("cookie"));
		raw = value === null ? undefined : parseJson(value);
	}
	if (raw === undefined) return NO_RECORD;
	let result = await validate(raw as Record<string, unknown>, RECORD_SCHEMA);
	return isFailure(result) ? NO_RECORD : result.data;
}

/** The record as the store keeps it; a cookie store answers the `Set-Cookie` value to send. */
async function writeRecord(
	ctx: RequestContext,
	store: "session" | Cookie,
	record: StoredRecord,
): Promise<string | null> {
	if (store !== "session") return store.serialize(JSON.stringify(record));
	sessionOf(ctx)?.set(SESSION_KEY, record);
	return null;
}

/**
 * Removes a stored record, so a visitor who withdraws consent keeps nothing. A cookie store
 * answers an expiring `Set-Cookie` only when the request carried the cookie.
 */
async function clearRecord(ctx: RequestContext, store: "session" | Cookie): Promise<string | null> {
	if (store !== "session") {
		let value = await store.parse(ctx.request.headers.get("cookie"));
		return value === null ? null : store.serialize("", { maxAge: 0, expires: new Date(0) });
	}
	let session = sessionOf(ctx);
	if (session?.has(SESSION_KEY)) session.unset(SESSION_KEY);
	return null;
}

/** The request's session, `undefined` on a route the session middleware does not cover. */
function sessionOf(ctx: RequestContext): Session | undefined {
	return ctx.has(Session) ? ctx.get(Session) : undefined;
}

/** The parsed JSON, `undefined` for text that is not JSON. */
function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

/**
 * The response with the cookie appended and marked `private`, so a shared cache never replays
 * one visitor's `Set-Cookie` to the next.
 */
function withCookie(response: Response, cookie: string): Response {
	let headers = new Headers(response.headers);
	headers.append("Set-Cookie", cookie);
	let cacheControl = (headers.get("Cache-Control") ?? "")
		.split(",")
		.map((directive) => directive.trim())
		.filter((directive) => directive !== "" && !/^(public|s-maxage=.*)$/i.test(directive));
	if (!cacheControl.some((directive) => /^(private|no-store)$/i.test(directive))) {
		cacheControl.unshift("private");
	}
	headers.set("Cache-Control", cacheControl.join(", "));
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
