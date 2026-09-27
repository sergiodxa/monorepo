/**
 * Typo suggestions for the domains of large mail providers: `gmial.com` suggests
 * `gmail.com`. A suggestion is a hint for a "did you mean" prompt, and providers whose
 * name is short enough to collide with real company domains are left out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { EmailAddress } from "./parse.js";

/**
 * The providers a typo is corrected toward, most used first so a tie goes to the likelier
 * one. Each name before the TLD has at least five letters, which keeps one edit from
 * landing on another real domain the way `aol.com` and `aon.com` would.
 */
const PROVIDER_DOMAINS = [
	"gmail.com",
	"yahoo.com",
	"hotmail.com",
	"outlook.com",
	"icloud.com",
	"googlemail.com",
	"protonmail.com",
	"yandex.com",
	"fastmail.com",
];

/** Real domains one edit away from a provider, which must never be "corrected". */
const KNOWN_DOMAINS = new Set([...PROVIDER_DOMAINS, "mail.com", "email.com", "ymail.com"]);

/** Domains of at least this many characters tolerate two edits; shorter ones only one. */
const TWO_EDIT_MIN_LENGTH = 10;

/**
 * Suggests the provider domain `address` most likely meant, keeping its local part as
 * entered. Returns `null` for a known domain and for one more than one edit (two for
 * domains of ten characters or more) from every provider.
 *
 * @param address - A parsed address.
 * @returns The corrected address, or `null` when there is nothing to suggest.
 * @example suggestDomain(address)?.address // "jane@gmail.com" for jane@gmial.com
 */
export function suggestDomain(address: EmailAddress): EmailAddress | null {
	if (KNOWN_DOMAINS.has(address.domain)) return null;

	for (let maxEdits of [1, 2]) {
		for (let provider of PROVIDER_DOMAINS) {
			if (maxEdits === 2 && provider.length < TWO_EDIT_MIN_LENGTH) continue;
			if (editDistance(address.domain, provider, maxEdits) > maxEdits) continue;

			return {
				address: `${address.localPart}@${provider}`,
				canonical: `${address.localPart.toLowerCase()}@${provider}`,
				localPart: address.localPart,
				domain: provider,
			};
		}
	}

	return null;
}

/**
 * Optimal string alignment distance: insertions, deletions, substitutions and adjacent
 * transpositions, the four slips a typist makes. Stops early once every path exceeds
 * `limit`, returning `limit + 1`.
 */
function editDistance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;

	let previous: number[] = [];
	let current = Array.from({ length: b.length + 1 }, (_, index) => index);

	for (let i = 1; i <= a.length; i++) {
		let beforePrevious = previous;
		previous = current;
		current = [i];
		let rowMin = i;

		for (let j = 1; j <= b.length; j++) {
			let cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let value = Math.min(
				(previous[j] ?? Infinity) + 1,
				(current[j - 1] ?? Infinity) + 1,
				(previous[j - 1] ?? Infinity) + cost,
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				value = Math.min(value, (beforePrevious[j - 2] ?? Infinity) + 1);
			}
			current[j] = value;
			rowMin = Math.min(rowMin, value);
		}

		if (rowMin > limit) return limit + 1;
	}

	return current[b.length] ?? limit + 1;
}
