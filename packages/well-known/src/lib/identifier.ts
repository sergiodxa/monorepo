/**
 * The identity comparison every discovery check rests on (RFC 8414 §3.3, OpenID
 * Connect Discovery §4.3, RFC 9728 §3.3): whether the identifier a document names is
 * the one its URL was built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Matches the trailing slashes a URL identifier carries interchangeably. */
const TRAILING_SLASHES = /\/+$/;

/**
 * An identifier in the form it compares. A URL identifier is read as a URL, so host
 * case and a trailing slash carry no meaning; any other identifier compares byte for
 * byte, as published.
 *
 * @param identifier - The identifier to read.
 */
function comparable(identifier: URL | string): string {
	let text = String(identifier);
	if (!URL.canParse(text)) return text;
	return new URL(text).href.replace(TRAILING_SLASHES, "");
}

/**
 * Whether two identifiers name the same issuer or resource.
 *
 * @param left - One identifier.
 * @param right - The other identifier.
 */
export function sameIdentifier(left: URL | string, right: URL | string): boolean {
	return comparable(left) === comparable(right);
}
