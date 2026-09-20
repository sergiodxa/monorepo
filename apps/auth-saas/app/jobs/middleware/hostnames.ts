/**
 * Publishes the Cloudflare custom-hostname client, so a job reads validation and SSL
 * status through `ctx.hostnames` and a test substitutes its own client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { HostnameClient } from "@sdxc/hostname";
import type { JobMiddleware } from "@sdxc/jobs";

import { createContextKey } from "remix/router";

import { createHostnameClient } from "~/app/lib/hostnames";

/** The custom-hostname client, published as `ctx.hostnames`. */
export const Hostnames = createContextKey<HostnameClient>();

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
