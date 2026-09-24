/**
 * Builds the URL a well-known document lives at for an identifier, applying the
 * placement rule its specification fixes, so an identifier carrying a path finds its
 * document where the server actually serves it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { WellKnownPlacement } from "./format.js";

/** Matches the slashes an identifier ends with before a suffix is appended. */
const TRAILING_SLASHES = /\/+$/;

/**
 * The URL a well-known document is served at for an identifier. Inserting keeps the
 * identifier's path and query after the suffix and drops a terminating slash after the
 * host (RFC 9728 §3.1); appending drops the query, fragment and trailing slashes.
 *
 * @param identifier - An absolute URL: an issuer, a resource, or an origin.
 * @param name - The registered suffix, such as `oauth-authorization-server`.
 * @param placement - Where the suffix goes; RFC 8414 and RFC 9728 insert, OIDC appends.
 * @returns The document's URL.
 * @example
 * wellKnownUrl("https://as.example/tenant", "oauth-authorization-server");
 * // https://as.example/.well-known/oauth-authorization-server/tenant
 * @example
 * wellKnownUrl("https://op.example/tenant", "openid-configuration", "append");
 * // https://op.example/tenant/.well-known/openid-configuration
 */
export function wellKnownUrl(
	identifier: URL | string,
	name: string,
	placement: WellKnownPlacement = "insert",
): URL {
	let source = new URL(identifier);

	if (placement === "append") {
		let path = source.pathname.replace(TRAILING_SLASHES, "");
		return new URL(`${path}/.well-known/${name}`, source.origin);
	}

	let path = source.pathname === "/" ? "" : source.pathname;
	let url = new URL(`/.well-known/${name}${path}`, source.origin);
	url.search = source.search;
	return url;
}
