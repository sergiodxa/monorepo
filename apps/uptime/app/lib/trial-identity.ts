/**
 * The two keys the free-watch cap compares: an address reduced to the person behind it, and
 * a URL reduced to the endpoint behind it.
 *
 * A free watch is a week of hourly outbound fetches given away for an email address, so the
 * offer has to be countable per person and per target. Comparing the raw strings does not
 * count anything: `https://example.com`, `https://example.com/` and
 * `https://example.com/#top` are one endpoint written three ways, and `hello+a@x.com`,
 * `hello+b@x.com` and `HELLO@x.com` are one inbox written three ways. Both functions here
 * exist only to collapse those spellings into a key the cap can hold, and neither value is
 * ever fetched, displayed, or written to.
 *
 * **Neither one replaces what the visitor typed.** The probe fetches the URL as given, the
 * mail goes to the address as given, and both are stored verbatim beside their key. That
 * split is the whole reason these are separate columns rather than a rewrite on the way in:
 * a normalizer is a guess about what two strings have in common, and a guess must never be
 * the thing we act on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The key one email address is capped under: lowercased, with any `+tag` removed from the
 * local part.
 *
 * Tagging is the bypass worth closing. `hello+a@`, `hello+b@` and `hello+c@` are three
 * strings and one inbox, so without this each of them would buy its own free week on the
 * same URL for the same person, forever. Lowercasing closes the other free one: the domain
 * is case-insensitive by specification, and no provider in practice treats a capitalised
 * local part as a second mailbox.
 *
 * **Dots are deliberately kept.** Gmail ignores them, which is the argument for stripping
 * them, and almost nobody else does — Fastmail, Proton, and every corporate mail server
 * route `first.last@` and `firstlast@` to two different people. Stripping would therefore
 * merge two strangers into one lead and hand one of them the other's report, which is a far
 * worse failure than letting a Gmail user with a dotted alias have a second free week.
 *
 * An address with no `@` is lowercased and returned as-is rather than rejected: this is a
 * key function, not a validator, and `TrialLeadSchema` has already refused anything that is
 * not an address by the time a caller gets here.
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
	 * `plus > 0` and not `plus !== -1`: an address whose local part *starts* with the tag
	 * separator has no untagged form to reduce to, and cutting at index 0 would key it as
	 * the empty local part shared by every other such address on the domain.
	 */
	if (plus > 0) local = local.slice(0, plus);

	return `${local}${domain}`;
}

/**
 * The key one URL is capped under: the same endpoint however it was spelled.
 *
 * Four reductions, and each closes a spelling that is the same request on the wire:
 *
 * - **The trailing slash goes.** `https://example.com/` and `https://example.com` are the
 *   same fetch, and `URL` produces the first from either.
 * - **The fragment goes entirely.** It is never sent to the server, so two URLs differing
 *   only after `#` cannot produce different check results.
 * - **Search params are sorted by key.** Order is not significant to the endpoints anyone
 *   would watch, and leaving it significant would make `?a=1&b=2` and `?b=2&a=1` two free
 *   weeks.
 * - **The host is lowercased**, which `URL` already does, because hostnames are
 *   case-insensitive. The path is not: plenty of servers serve `/A` and `/a` differently.
 *
 * **The scheme is kept distinct, on purpose.** `http://example.com` and
 * `https://example.com` are two genuinely different endpoints — different ports, often
 * different behaviour, and telling somebody their plaintext origin is fine because their
 * TLS one is would be the kind of wrong answer this product exists not to give. So they get
 * a free week each, and that is not a hole to close later.
 *
 * A string `URL` cannot parse is trimmed and returned unchanged, so it still keys against
 * itself. The trial page's guard has already resolved every stored URL through `URL`, so
 * this branch is unreachable from the one caller that matters and exists so the function is
 * total.
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
	 * The slash is taken off the path rather than off the end of the string, so that
	 * `/health/?deep=1` and `/health?deep=1` land on one key too. The root path becomes the
	 * empty string, which is what makes a bare origin key as `https://example.com`.
	 */
	let path = parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;

	/** `host` and not `hostname`, so a non-default port stays part of the endpoint. */
	return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
}
