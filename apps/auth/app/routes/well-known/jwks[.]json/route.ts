/**
 * The JWKS route (/.well-known/jwks.json). Its loader returns the provider's public
 * JSON Web Key Set from the OIDC service, exposing the keys used to sign issued tokens.
 * Exists so relying parties and resource servers can fetch the keys needed to verify
 * ID token and access token signatures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/http/response/json";

import oidc from "~/services/oidc";

export async function loader() {
	return ok(await oidc.jwks);
}
