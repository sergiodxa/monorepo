/**
 * Records where a visitor first arrived, once, in session, until a sign-in can attach it to
 * a lead in `trial_conversions`, the one table that outlives every trial row.
 *
 * The value is written only when the session has none, so a visitor who lands from an
 * outreach link keeps that credit through however many pages they browse next; overwriting
 * on each page would hand every conversion to whichever page ran last, almost always the homepage.
 *
 * Three short fields survive: a path, and two allowlisted campaign parameters capped to a
 * length that cannot smuggle a payload, keeping the record disposable the moment a lead
 * unsubscribes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Session } from "remix/session";

/**
 * Session key the first-touch record travels under, held as an ordinary session value so it
 * survives an arbitrary number of reads across an unknown number of requests until the
 * sign-in that consumes it copies it onto `trial_conversions`.
 */
export const TRIAL_ATTRIBUTION = "trialAttribution";

/**
 * How much of a campaign value is kept: long enough for names an operator actually types,
 * short enough that the column cannot carry a side payload. Longer values are truncated,
 * so a recognisable prefix still attributes the visit.
 */
const MAX_CAMPAIGN_LENGTH = 64;

/** Query parameters read as campaign identifiers, in the order each field prefers them. */
const SOURCE_PARAMS = ["utm_source", "ref", "source"] as const;
const CAMPAIGN_PARAMS = ["utm_campaign", "campaign"] as const;

/** Where a visitor arrived, as the funnel report reads it. */
export interface TrialAttribution {
	/** The URL pathname of the first page they landed on. */
	landingPath: string;
	source: string | null;
	campaign: string | null;
	/** When they first arrived, which dates the attribution independently of any lead. */
	arrivedAt: number;
}

/**
 * Reads the first present parameter from a list, normalized to something safe to store.
 * Lowercased so `?ref=Twitter` and `?ref=twitter` collapse to one source, and restricted to
 * a slug's character class, since anything wider risks smuggling something else into the column.
 */
function readParam(url: URL, names: readonly string[]): string | null {
	for (let name of names) {
		let raw = url.searchParams.get(name);
		if (!raw) continue;

		let value = raw.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
		if (value.length > 0) return value.slice(0, MAX_CAMPAIGN_LENGTH);
	}

	return null;
}

/**
 * Builds the first-touch record for a request.
 *
 * Exported for the guard that pins the normalization, which is the part with rules in it —
 * the middleware around it only decides whether to write.
 *
 * @param url - The request's URL.
 * @param now - The instant to stamp, injectable so tests are not clock-dependent.
 * @example readAttribution(new URL("https://uptime.test/for/agencies?ref=outreach"))
 */
export function readAttribution(url: URL, now: number = Date.now()): TrialAttribution {
	return {
		landingPath: url.pathname,
		source: readParam(url, SOURCE_PARAMS),
		campaign: readParam(url, CAMPAIGN_PARAMS),
		arrivedAt: now,
	};
}

/**
 * Captures first-touch attribution on `GET` page views that don't already have one. A `POST`
 * always comes from a page that already ran this middleware, so only `GET` needs it here. When
 * no session is present, it belongs to a machine path the session middleware never touches.
 */
export let attribution: Middleware = (context, next) => {
	if (context.request.method !== "GET") return next();

	let session = context.get(Session);
	if (!session || session.get(TRIAL_ATTRIBUTION) !== undefined) return next();

	session.set(TRIAL_ATTRIBUTION, readAttribution(context.url));

	return next();
};
