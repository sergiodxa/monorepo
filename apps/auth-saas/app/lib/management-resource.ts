/**
 * The management API as an RFC 9728 protected resource: its identifier is the API's
 * own origin and its authorization server is that same host's `/oauth/token`, so a
 * client holding only the API URL finds where to get a token and which scopes exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Issuer } from "@sdxc/auth/issuer";
import { ResourceServer } from "@sdxc/auth/resource-server";

import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";

/** The management API's resource server; its options state `resource`, so its metadata is always present. */
export type ManagementResourceServer = ResourceServer<ResourceServer.ResourceOptions>;

/**
 * Builds the resource server every management refusal takes its challenge from and the
 * well-known route serves metadata from. The issuer is read through RFC 8414, since the
 * management API is an OAuth-only authorization server with no OpenID Connect document.
 *
 * @param issuer - The management API's own origin, `https://api.{PLATFORM_DOMAIN}`.
 * @returns The resource server, bound to `issuer` as its resource identifier.
 * @example
 * let api = managementResourceServer("https://api.example.com");
 * api.challenge({ error: "invalid_token" });
 */
export function managementResourceServer(issuer: string): ManagementResourceServer {
	return new ResourceServer(new Issuer(issuer, { discovery: "oauth" }), {
		resource: issuer,
		metadata: {
			scopesSupported: [...MANAGEMENT_SCOPES],
			resourceName: { value: "Management API", translations: {} },
		},
	});
}
