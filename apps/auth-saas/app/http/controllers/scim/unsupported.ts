/**
 * Two reachable routes that answer `501` rather than the router's generic
 * `404`: `POST /scim/v2/Bulk`, since an envelope moves a burst rather than
 * reducing it against one single-threaded object, and `GET /scim/v2/Me`,
 * since the token names a connection and there is no person for the alias to
 * resolve to. Both match what `ServiceProviderConfig` already advertises as
 * unsupported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { scimError } from "~/app/http/scim/response";
import routes from "~/routes/tenant";

/** `POST /scim/v2/Bulk` — always `501`; `bulk.supported: false` in `ServiceProviderConfig`. */
export const scimBulk = createAction(routes.scimBulk, async () => {
	return scimError({ status: 501, detail: "Bulk operations are not supported." });
});

/** `GET /scim/v2/Me` — always `501`; a connection's bearer token names no person. */
export const scimMe = createAction(routes.scimMe, async () => {
	return scimError({
		status: 501,
		detail: "/Me has no meaning for a connection's own bearer token.",
	});
});
