/**
 * Merging of `Vary` header names, so a response that negotiates on one dimension
 * can add a second without discarding the first. Header names are the cache key,
 * which is why this merges instead of replacing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Vary } from "remix/headers";

/**
 * Adds request header names to a response's `Vary`, keeping whatever is
 * there. Each header multiplies the cache variants stored for the URL, so
 * varying on `Cookie` disables shared caching; prefer `Policies.private()`.
 *
 * @param headers - Response headers to merge into; mutated in place.
 * @param names - Request header names the response depends on.
 * @returns The same `Headers` object, for chaining.
 *
 * @example
 * vary(headers, ["Accept-Language", "Cookie"]);
 * @example
 * let headers = new Headers({ Vary: "Accept-Encoding" });
 * vary(headers, "Accept-Language").get("Vary"); // "accept-encoding, accept-language"
 */
export function vary(headers: Headers, names: string | string[]): Headers {
	let value = Vary.from(headers.get("Vary"));

	for (let name of typeof names === "string" ? [names] : names) value.add(name);

	if (value.size === 0) return headers;

	headers.set("Vary", value.toString());

	return headers;
}
