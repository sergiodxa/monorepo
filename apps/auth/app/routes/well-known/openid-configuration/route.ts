import { ok } from "@pkg/http/response/json";

import { WELL_KNOWN } from "~/config";

/**
 * OIDC Discovery Endpoint
 * Provides the same metadata as the OAuth 2.0 Authorization Server Metadata
 * endpoint but at the standard OIDC location.
 *
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html
 */
export function loader() {
	return ok(WELL_KNOWN);
}
