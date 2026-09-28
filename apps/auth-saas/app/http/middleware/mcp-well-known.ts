/**
 * The MCP server's own RFC 9728 protected-resource metadata, naming the platform
 * tenant's own OIDC issuer as its authorization server — the one already published
 * for the management API, since a bearer token minted there is the same one this
 * server accepts, forwarded straight through to the real management route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { define, protectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";

import { platformTenantIssuer } from "~/app/lib/platform-tenant";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";

/**
 * Builds the middleware answering the MCP server's protected-resource metadata.
 *
 * @param resource - The MCP server's own resource identifier, the bare platform origin.
 * @returns The middleware, for the MCP router's global chain.
 * @example
 * createRouter({ middleware: [mcpWellKnown(`https://${env.PLATFORM_DOMAIN}`)] });
 */
export function mcpWellKnown(resource: string): Middleware {
	return wellKnown({
		"oauth-protected-resource": serve(protectedResourceMetadata, () =>
			define({
				resource: new URL(resource),
				authorizationServers: [new URL(platformTenantIssuer())],
				scopesSupported: [...MANAGEMENT_SCOPES],
				resourceName: { value: "Management API MCP Server", translations: {} },
			}),
		),
	});
}
