/**
 * Builds a touch from the URL a visitor landed on and the `Referer` they sent: the campaign
 * parameters as short slugs, the click identifier's network, the external referrer, and the
 * channel those add up to. Every stored value is disposable, so nothing here identifies a person.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Channel, Click, Referrer, ReferrerKind, Touch, Utm } from "./types.js";

import { CAMPAIGN_PARAMETERS, CLICK_IDENTIFIERS } from "./parameters.js";
import { classifyReferrer } from "./referrer.js";

/** How much of a campaign value is kept: enough for any name a person types into a link. */
const MAX_VALUE_LENGTH = 64;

/** How much of a kept click identifier is stored; the networks' own identifiers fit well inside. */
const MAX_CLICK_VALUE_LENGTH = 256;

/** How much of the landing path is kept, so a touch stays small enough for a cookie. */
const MAX_LANDING_PATH_LENGTH = 256;

/** Options for {@link readTouch}. */
export interface ReadTouchOptions {
	/** The request's `Referer` header, or `null` when it sent none. */
	referrer: string | null;
	/**
	 * The touch's `at` stamp, as epoch milliseconds.
	 *
	 * @default Date.now()
	 */
	now?: number;
	/**
	 * Extra parameters read for a `Utm` field when its `utm_*` parameter is absent, in order.
	 *
	 * @default { source: ["ref"] }
	 */
	aliases?: Readonly<Partial<Record<keyof Utm, readonly string[]>>>;
	/**
	 * `"keep"` stores the click identifier's value, for an app that uploads offline conversions
	 * to the ad network; `"network"` stores only which network it names.
	 *
	 * @default "network"
	 */
	clickIds?: "network" | "keep";
	/** Extra `host → kind` entries merged over the built-in referrer table. */
	referrers?: Readonly<Record<string, ReferrerKind>>;
}

/** The aliases a link written by hand most often uses in place of `utm_source`. */
const DEFAULT_ALIASES: NonNullable<ReadTouchOptions["aliases"]> = { source: ["ref"] };

/**
 * The touch a request describes. A same-host referrer is internal navigation and reads as no
 * referrer, so a page view inside the site with no campaign is `direct`.
 *
 * @param url - The URL the visitor landed on.
 * @example readTouch(ctx.url, { referrer: ctx.request.headers.get("referer") })
 */
export function readTouch(url: URL, options: ReadTouchOptions): Touch {
	let params = foldedParams(url.searchParams);
	let utm = readUtm(params, options.aliases ?? DEFAULT_ALIASES);
	let click = readClick(params, options.clickIds ?? "network");
	let emailPlatform = [...params.keys()].some((name) => CLICK_IDENTIFIERS[name]?.kind === "email");
	let referrer = classifyReferrer(options.referrer, {
		host: url.hostname,
		referrers: options.referrers,
	});

	return {
		at: options.now ?? Date.now(),
		landingPath: url.pathname.slice(0, MAX_LANDING_PATH_LENGTH),
		utm,
		click,
		referrer,
		channel: channelOf(utm, click, referrer, emailPlatform),
	};
}

/**
 * A campaign value reduced to a slug: trimmed, lowercased, whitespace runs joined by `-`, only
 * `[a-z0-9._+-]` kept, cut at 64 characters. A value holding `@` or `://` is an address or a URL
 * a merge tag put there, and reads as absent along with one that normalizes to nothing.
 *
 * @example normalizeValue("Launch Week") // "launch-week"
 * @example normalizeValue("jane@example.com") // undefined
 */
export function normalizeValue(raw: string): string | undefined {
	if (raw.includes("@") || raw.includes("://")) return undefined;
	let slug = raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9._+-]/g, "")
		.slice(0, MAX_VALUE_LENGTH);
	return slug === "" ? undefined : slug;
}

/** The query parameters by lowercase name, first occurrence winning. */
function foldedParams(search: URLSearchParams): Map<string, string> {
	let params = new Map<string, string>();
	for (let [name, value] of search) {
		let folded = name.toLowerCase();
		if (!params.has(folded)) params.set(folded, value);
	}
	return params;
}

/** The campaign fields the URL carries, `null` when it carries none. */
function readUtm(
	params: Map<string, string>,
	aliases: NonNullable<ReadTouchOptions["aliases"]>,
): Utm | null {
	let utm: Utm = {};
	let found = false;
	for (let field of Object.keys(CAMPAIGN_PARAMETERS) as (keyof Utm)[]) {
		for (let name of [CAMPAIGN_PARAMETERS[field], ...(aliases[field] ?? [])]) {
			let raw = params.get(name.toLowerCase());
			let value = raw === undefined ? undefined : normalizeValue(raw);
			if (value === undefined) continue;
			utm[field] = value;
			found = true;
			break;
		}
	}
	return found ? utm : null;
}

/**
 * The first ad-network click identifier on the URL. Email-platform parameters encode the
 * subscriber, so they never become a click.
 */
function readClick(params: Map<string, string>, clickIds: "network" | "keep"): Click | null {
	for (let [name, raw] of params) {
		let identifier = CLICK_IDENTIFIERS[name];
		if (!identifier || identifier.kind === "email") continue;
		let click: Click = { param: name, network: identifier.network, paid: identifier.paid };
		let value = raw.trim().slice(0, MAX_CLICK_VALUE_LENGTH);
		if (clickIds === "keep" && value !== "") click.value = value;
		return click;
	}
	return null;
}

/** `utm_medium` values that name each channel, compared after normalization. */
const MEDIUMS = {
	paidSearch: new Set(["cpc", "ppc", "paid-search", "paidsearch"]),
	paidSocial: new Set(["paid-social", "paidsocial", "social-paid"]),
	display: new Set(["display", "banner", "cpm"]),
	email: new Set(["email", "e-mail", "newsletter"]),
	social: new Set(["social", "social-network", "sm"]),
};

/** The kind of network a click identifier belongs to, read from the parameter table. */
function clickKind(click: Click | null): string | undefined {
	return click ? CLICK_IDENTIFIERS[click.param]?.kind : undefined;
}

/**
 * The channel a touch is credited to: the first rule that matches, from paid search down to
 * direct. An explicit medium and the click or referrer evidence count equally within a rule.
 */
function channelOf(
	utm: Utm | null,
	click: Click | null,
	referrer: Referrer | null,
	emailPlatform: boolean,
): Channel {
	let medium = utm?.medium;
	let kind = clickKind(click);
	let paid = click?.paid === true;
	let is = (set: Set<string>) => medium !== undefined && set.has(medium);

	if (is(MEDIUMS.paidSearch) || (paid && kind === "search")) return "paid-search";
	if (is(MEDIUMS.paidSocial) || (paid && kind === "social")) return "paid-social";
	if (is(MEDIUMS.display) || kind === "display") return "display";
	if (is(MEDIUMS.email) || emailPlatform || referrer?.kind === "email") return "email";
	if (medium === "affiliate") return "affiliate";
	if (is(MEDIUMS.social) || (!paid && kind === "social") || referrer?.kind === "social") {
		return "organic-social";
	}
	if (medium === "organic" || referrer?.kind === "search") return "organic-search";
	if (medium === "referral" || referrer?.kind === "other") return "referral";
	if (utm !== null) return "other";
	return "direct";
}
