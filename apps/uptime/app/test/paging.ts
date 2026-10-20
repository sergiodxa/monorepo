/**
 * Test helper for walking a paginated API response. A paginated endpoint advertises
 * its navigation in `Link` rather than in the body, so a test that wants the next
 * page has to read the header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse } from "@sdxc/link-header";

/**
 * Reads one relation's target out of a `Link` header. The path and query come back
 * rather than the whole URL, because that is what the request helpers take; the
 * origin is the test's own and asserting on it would only restate the host the
 *
 * @param header The response's `Link` header, or `null` when it sent none.
 * @param rel The relation to look for, `next` by default.
 * @returns The path and query to request, or `null` when no such page is advertised.
 * @example
 * let next = parseLink(response.headers.get("Link"));
 */
export function parseLink(header: string | null, rel = "next"): string | null {
	for (let link of parse(header)) {
		if (!link.rels.includes(rel)) continue;
		let url = new URL(link.target);
		return `${url.pathname}${url.search}`;
	}

	return null;
}
