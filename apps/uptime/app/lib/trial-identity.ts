/**
 * Normalizes the email and URL keys the free-watch cap compares, so a
 * tagged address, a trailing slash, or an unordered query string cannot
 * buy a second free week under a spelling that is really the same person
 * or the same endpoint. The raw values used to send mail and run the
 * probe are stored and used untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The key one email address is capped under: lowercased, with any `+tag`
 * removed from the local part. Dots stay, since most providers treat a
 * dotted local part as a different inbox than the undotted one.
 *
 * @param email - The address as it was typed.
 * @returns The key to compare and store on `leads.normalized_email`.
 * @example normalizeLeadEmail("Hello+Sale@Example.com") // "hello@example.com"
 */
export function normalizeLeadEmail(email: string): string {
	let lowered = email.trim().toLowerCase();

	let at = lowered.lastIndexOf("@");
	if (at <= 0) return lowered;

	let local = lowered.slice(0, at);
	let domain = lowered.slice(at);

	let plus = local.indexOf("+");
	/**
	 * An address whose local part begins with `+` keeps that character: the
	 * check excludes index 0, since cutting there would key it as the same
	 * empty local part shared by every other such address on the domain.
	 */
	if (plus > 0) local = local.slice(0, plus);

	return `${local}${domain}`;
}

/**
 * The key one URL is capped under: trailing slash and fragment removed,
 * query params sorted by key, host lowercased. The scheme stays distinct,
 * since `http://` and `https://` differ enough to earn separate caps.
 *
 * @param url - The URL as the probe resolved it.
 * @returns The key to compare and store on `trial_watches.normalized_url`.
 * @example normalizeTrialUrl("https://Example.com/a/?b=2&a=1#top") // "https://example.com/a?a=1&b=2"
 */
export function normalizeTrialUrl(url: string): string {
	let parsed: URL;

	try {
		parsed = new URL(url);
	} catch {
		return url.trim();
	}

	parsed.searchParams.sort();

	/**
	 * The path itself loses its trailing slash, so `/health/?deep=1` and
	 * `/health?deep=1` land on one key, and a root path collapses to the
	 * empty string, producing a bare origin key like `https://example.com`.
	 */
	let path = parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;

	/** `parsed.host` includes a non-default port, keeping it part of the endpoint identity. */
	return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
}
