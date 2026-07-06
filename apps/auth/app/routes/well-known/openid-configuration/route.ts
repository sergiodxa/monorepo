/**
 * The OIDC discovery route (/.well-known/openid-configuration). Its loader returns the
 * provider's well-known metadata document describing endpoints, supported scopes,
 * response types and signing algorithms. Exists so relying parties can auto-configure
 * against this authorization server per OpenID Connect Discovery 1.0.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
