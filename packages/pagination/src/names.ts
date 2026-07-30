/**
 * The query parameter names both halves of paging have to agree on.
 *
 * Parsing reads them off an incoming URL and `Link` generation writes them into the
 * URLs it advertises, so they live in one place; an API that spells its parameters
 * differently binds them once through `createPaging()` rather than at each call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** What each paging parameter is called in a query string. */
export interface PagingNames {
	/** Parameter holding the 1-based page number. */
	page: string;
	/** Parameter holding the requested page size. */
	perPage: string;
	/** Parameter holding an opaque keyset cursor. */
	cursor: string;
}

/** Names used when nothing is bound, which is what the standalone functions read and write. */
export const DEFAULT_PAGING_NAMES: PagingNames = {
	page: "page",
	perPage: "perPage",
	cursor: "cursor",
};

/** Rows per page when a request does not ask for a size. */
export const DEFAULT_PER_PAGE = 25;

/** Largest page size a request may ask for, so a client cannot ask for everything. */
export const DEFAULT_MAX_PER_PAGE = 100;

/**
 * Fills in the names a caller left out.
 *
 * @param names A partial spelling of the paging parameters.
 * @returns Every name, defaulted to `page`, `perPage`, and `cursor`.
 */
export function resolveNames(names?: Partial<PagingNames>): PagingNames {
	return {
		page: names?.page ?? DEFAULT_PAGING_NAMES.page,
		perPage: names?.perPage ?? DEFAULT_PAGING_NAMES.perPage,
		cursor: names?.cursor ?? DEFAULT_PAGING_NAMES.cursor,
	};
}
