/**
 * Validates the search dialog frame's query string, so the tab a reader narrowed the
 * matches to arrives as one of the kinds a search reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { enum_, object, optional } from "remix/data-schema";

import { SEARCH_KINDS } from "~/app/services/search-query";

/**
 * `kind` names the tab the dialog lists; absent, the dialog lists every kind. Any other
 * value fails the whole query, which the frame answers as the "All" tab.
 */
export const SearchFrameQuerySchema = object({
	kind: optional(enum_(SEARCH_KINDS)),
});
