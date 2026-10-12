/**
 * A tenant's `/userinfo` as an RFC 9728 protected resource: the userinfo URL is the
 * resource identifier and the tenant's own issuer its authorization server, so a
 * client refused at `/userinfo` follows the challenge to where it gets a token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WellKnownEntry } from "@sdxc/well-known/middleware";

import { Issuer } from "@sdxc/auth/issuer";
import { ResourceServer } from "@sdxc/auth/resource-server";
import { serve } from "@sdxc/well-known/middleware";
import { protectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";

import { TENANT_ISSUER_HEADER } from "~/app/http/middleware/tenant";

/** The userinfo resource server; its options state `resource`, so its metadata is always present. */
export type UserinfoResourceServer = ResourceServer<ResourceServer.ResourceOptions>;

/**
 * The userinfo URL a tenant's access tokens name as their audience, which is also the
 * resource identifier its metadata publishes.
 *
 * @param issuer - The tenant's issuer.
 */
export function userinfoResource(issuer: string): URL {
	return new URL("/userinfo", issuer);
}

/**
 * Builds the resource server a tenant's `/userinfo` challenges from and its metadata is
 * served from, per request, since the issuer differs per tenant.
 *
 * @param issuer - The tenant's issuer.
 * @returns The resource server, bound to the tenant's userinfo URL.
 * @example
 * userinfoResourceServer(ctx.tenant.issuer).challenge({ error: "invalid_token" });
 */
export function userinfoResourceServer(issuer: string): UserinfoResourceServer {
	return new ResourceServer(new Issuer(issuer, { identifier: issuer }), {
		resource: userinfoResource(issuer),
		metadata: { scopesSupported: ["openid"] },
	});
}

/**
 * The `wellKnown()` entry answering `/.well-known/oauth-protected-resource/userinfo` with
 * the requesting tenant's userinfo metadata. It reads the tenant's issuer off the header
 * the Worker stamps before the tenant router runs; any other resource path falls through.
 *
 * @example
 * wellKnown({ "oauth-protected-resource": userinfoMetadataEntry });
 */
export const userinfoMetadataEntry: WellKnownEntry = serve(protectedResourceMetadata, (ctx) => {
	let issuer = ctx.request.headers.get(TENANT_ISSUER_HEADER);
	if (!issuer) return null;

	let api = userinfoResourceServer(issuer);
	if (ctx.url.pathname !== api.metadataUrl.pathname) return null;

	return api.metadata();
});
