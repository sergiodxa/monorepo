/**
 * The one keyset-pagination configuration every management API list route shares:
 * `per_page`/`cursor` query parameters, and the `Link` header they page through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createPaging } from "@sdxc/pagination";

/**
 * Parses `per_page`/`cursor` off a request and writes the `Link` `rel="prev"`/
 * `rel="next"` a keyset page answers with.
 *
 * @example
 * let params = managementPaging.parse(ctx.url.searchParams);
 * let headers = managementPaging.paginate(new Headers(), page, { url: ctx.url });
 */
export const managementPaging = createPaging({
	names: { perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});
