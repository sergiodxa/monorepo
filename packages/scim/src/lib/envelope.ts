/**
 * The `ListResponse` body (RFC 7644 §3.4.2), shared by `listResponse` and the discovery
 * documents, which RFC 7644 §4 also answers as a list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LIST_RESPONSE_SCHEMA } from "./constants.js";

/**
 * A `ListResponse` body over already-serialized resources. `itemsPerPage` is the length of
 * the page itself, which is what RFC 7644 §3.4.2 defines it as.
 *
 * @param resources - The page's wire objects
 * @param totalResults - How many resources match across every page
 * @param startIndex - The one-based index of the page's first resource
 * @returns The envelope
 */
export function listEnvelope(
	resources: object[],
	totalResults: number,
	startIndex: number,
): Record<string, unknown> {
	return {
		schemas: [LIST_RESPONSE_SCHEMA],
		totalResults,
		startIndex,
		itemsPerPage: resources.length,
		Resources: resources,
	};
}
