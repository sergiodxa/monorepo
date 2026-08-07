/**
 * Static configuration for the OAuth 2.0 / OpenID Connect authorization server.
 * Declares the identity the server presents to relying parties — its own client
 * registration first, with the issuer, token lifetimes and discovery document
 * following as the endpoints that publish them are built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Display name of the authorization server's own OAuth client registration. */
export const AUTH_SERVER_NAME = "Auth by Sergio Xalambrí";

/**
 * Client id of the authorization server's own registration, used when the server
 * signs a person in to its own account area. Frozen: the row already exists in
 * production under this id and relying parties' sessions reference it.
 */
export const AUTH_SERVER_CLIENT_ID = "d12d3901-3cbe-468b-adf5-ac3d3e015728";
