/**
 * Records where a visitor came from, once, on their first HTML page view, and keeps it in
 * the session until it can be attached to something durable.
 *
 * This is the front of the funnel, and it is the part nothing else can see. `trial_daily_stats`
 * counts leads, watches, sign-ups and payments — every one of which happens *after* somebody
 * has already decided to hand over an address. Which page brought them and which campaign
 * sent them are only knowable while they are still anonymous, and the sign-in that finally
 * identifies them is several requests and possibly several days later. So it is carried in the
 * session and copied onto `trial_conversions` at sign-in, which is the one table that outlives
 * every trial row.
 *
 * **First touch wins, and never the last.** The value is written only when the session has
 * none, so a visitor who arrives from an outreach link and then browses four feature pages is
 * still attributed to the outreach link. Overwriting per page view would attribute every
 * conversion to whichever page happened to be last, which for this site is almost always the
 * homepage — the one page that tells you nothing.
 *
 * **It collects no personal data, by construction.** Three short fields survive: the path
 * (never the query string), and two allowlisted campaign parameters truncated to a length
 * that cannot smuggle a payload. There is no referrer, no address, no identifier, and nothing
 * a visitor typed. An attribution record must never become a reason a lead's data outlives
 * their unsubscribe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Session } from "remix/session";

/**
 * Session key the first-touch record travels under.
 *
 * A plain session value rather than a flash, for the reason the rest of this feature's state
 * is: it has to survive an arbitrary number of reads across an unknown number of requests
 * before the sign-in that consumes it, which is the opposite of show-once.
 */
export const TRIAL_ATTRIBUTION = "trialAttribution";

/**
 * How much of a campaign value is kept.
 *
 * Long enough for the campaign names an operator actually types, short enough that the column
 * cannot be used as a side channel for something else. A longer value is truncated rather
 * than dropped, since a recognisable prefix still attributes the visit.
 */
const MAX_CAMPAIGN_LENGTH = 64;

/** Query parameters read as campaign identifiers, in the order each field prefers them. */
const SOURCE_PARAMS = ["utm_source", "ref", "source"] as const;
const CAMPAIGN_PARAMS = ["utm_campaign", "campaign"] as const;

/** Where a visitor arrived, as the funnel report reads it. */
export interface TrialAttribution {
	/** The path of the first page they landed on. Never the query string. */
	landingPath: string;
	/** The campaign source, when the link carried one. */
	source: string | null;
	/** The campaign name, when the link carried one. */
	campaign: string | null;
	/** When they first arrived, which dates the attribution independently of any lead. */
	arrivedAt: number;
}

/**
 * Reads the first present parameter from a list, normalized to something safe to store.
 *
 * Lowercased so `?ref=Twitter` and `?ref=twitter` are one source rather than two, and
 * restricted to a conservative character class: a campaign identifier is a slug, and anything
 * outside that is either a mistake or an attempt to put something else in the column.
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
 * Captures first-touch attribution on `GET` page views that don't already have one.
 *
 * Restricted to `GET` because a `POST` is never somebody's first arrival — it is an action
 * taken from a page that already ran this — and attributing a form submission would record
 * the action's own path as the landing page.
 *
 * Writing nothing when a record already exists is what makes this safe to run on every page:
 * the common case is a session read and a comparison, with no write and therefore no `Set-Cookie`
 * churn on pages that are otherwise cacheable.
 */
export let attribution: Middleware = (context, next) => {
	if (context.request.method !== "GET") return next();

	// Absent on the surfaces the session middleware skips. Nothing to record and nowhere to
	// record it, which is not a fault: those are machine paths with no visitor behind them.
	let session = context.get(Session);
	if (!session || session.get(TRIAL_ATTRIBUTION) !== undefined) return next();

	session.set(TRIAL_ATTRIBUTION, readAttribution(context.url));

	return next();
};
