/**
 * Publishes the Cloudflare custom-hostname client, so a job reads validation and SSL
 * status through `ctx.hostnames` and a test substitutes its own client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@pkg/jobs-next";

import { HostnameClient } from "@pkg/hostname";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

/** The custom-hostname client, published as `ctx.hostnames`. */
export const Hostnames = createContextKey<HostnameClient>();

/**
 * Builds the custom-hostname client for the platform zone, tagging each hostname's
 * metadata with `blog_id` so the worker can route a request straight from it.
 *
 * @returns A client for the zone's custom hostnames.
 */
export function createHostnameClient(): HostnameClient {
	return new HostnameClient({
		apiToken: env.CF_API_TOKEN,
		zoneId: env.CF_ZONE_ID,
		platformDomain: env.PLATFORM_DOMAIN,
		metadataKey: "blog_id",
	});
}

/**
 * Publishes the custom-hostname client for the job about to run.
 *
 * @returns The middleware installing it as `ctx.hostnames`.
 */
export function hostnames(): JobMiddleware<{
	key: typeof Hostnames;
	value: HostnameClient;
	property: "hostnames";
}> {
	return async (ctx, next) => {
		ctx.set(Hostnames, createHostnameClient(), { property: "hostnames" });
		await next();
	};
}
