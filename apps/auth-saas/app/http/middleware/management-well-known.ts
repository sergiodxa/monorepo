/**
 * The management API host's discovery documents: RFC 9728 protected-resource metadata
 * naming the API and its scopes, RFC 8414 metadata naming `/oauth/token`, and the
 * platform key set management tokens are signed with, so a client needs only the API URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { jwks } from "@sdxc/well-known/jwks";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { authorizationServerMetadata, define } from "@sdxc/well-known/oauth-authorization-server";
import { protectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";

import { managementResourceServer } from "~/app/lib/management-resource";
import { platformTenantStub } from "~/app/lib/platform-tenant";

/**
 * Builds the middleware answering the three documents on the management host. The
 * authorization server advertises only `client_credentials`, the one grant its token
 * endpoint answers, and lists the API as its protected resource (RFC 9728 §4).
 *
 * @param issuer - The management API's own origin, `https://api.{PLATFORM_DOMAIN}`.
 * @returns The middleware, for the management router's global chain after `database`.
 * @example
 * createRouter({ middleware: [database(createDatabase), managementWellKnown(issuer)] });
 */
export function managementWellKnown(issuer: string): Middleware {
	let api = managementResourceServer(issuer);

	return wellKnown({
		"oauth-protected-resource": serve(protectedResourceMetadata, () => api.metadata()),
		"oauth-authorization-server": serve(authorizationServerMetadata, () =>
			define({
				issuer,
				tokenEndpoint: new URL("/oauth/token", issuer),
				jwksUri: new URL("/.well-known/jwks.json", issuer),
				responseTypesSupported: [],
				grantTypesSupported: ["client_credentials"],
				tokenEndpointAuthMethodsSupported: ["client_secret_basic", "client_secret_post"],
				scopesSupported: api.metadata().scopesSupported,
				protectedResources: [api.resource],
			}),
		),
		"jwks.json": serve(jwks, async () => platformTenantStub().publishKeySet()),
	});
}
