/**
 * The OAuth 2.0 Authorization Server Metadata route
 * (/.well-known/oauth-authorization-server). Its loader returns the same well-known
 * metadata document as the OIDC discovery endpoint, exposing the server's endpoints and
 * capabilities. Exists so OAuth clients can discover this server's configuration per
 * RFC 8414.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/http/response/json";

import { WELL_KNOWN } from "~/config";

export function loader() {
	return ok(WELL_KNOWN);
}
