/**
 * The `ListResponse` body (RFC 7644 §3.4.2), shared by `listResponse` and the discovery
 * documents, which RFC 7644 §4 also answers as a list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LIST_RESPONSE_SCHEMA } from "./constants.js";

/** Where a page sits among its query's results, as the envelope reports it. */
export interface EnvelopePosition {
	/** How many resources match across every page; left out when absent. */
	totalResults?: number;
	/** The one-based index of the page's first resource, on an index page. */
	startIndex?: number;
	/** RFC 9865's cursor of the following page, written only when non-empty. */
	nextCursor?: string | null;
	/** RFC 9865's cursor of the preceding page, written only when non-empty. */
	previousCursor?: string | null;
}

/**
 * A `ListResponse` body over already-serialized resources. `itemsPerPage` is the length of
 * the page itself, which is what RFC 7644 §3.4.2 defines it as, and an absent `nextCursor`
 * is how RFC 9865 marks the last page of a cursor-paged query.
 *
 * @param resources - The page's wire objects
 * @param position - The total and the page's index or cursors
 * @returns The envelope
 */
export function listEnvelope(
	resources: object[],
	position: EnvelopePosition,
): Record<string, unknown> {
	return {
		schemas: [LIST_RESPONSE_SCHEMA],
		...(position.totalResults === undefined ? {} : { totalResults: position.totalResults }),
		...(position.startIndex === undefined ? {} : { startIndex: position.startIndex }),
		itemsPerPage: resources.length,
		...(position.nextCursor ? { nextCursor: position.nextCursor } : {}),
		...(position.previousCursor ? { previousCursor: position.previousCursor } : {}),
		Resources: resources,
	};
}
