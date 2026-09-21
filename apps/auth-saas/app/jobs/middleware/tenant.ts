/**
 * Publishes the tenant Durable Object namespace binding, so a job reaches into any
 * tenant's own storage through `ctx.tenant` and a test substitutes its own namespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@sdxc/jobs";

import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

import type TenantObject from "~/database/tenant-do";

/** The tenant Durable Object namespace binding, published as `ctx.tenant`. */
export const TenantNamespace = createContextKey<DurableObjectNamespace<TenantObject>>();

/**
 * Publishes the tenant Durable Object namespace binding for the job about to run.
 *
 * @returns The middleware installing it as `ctx.tenant`.
 * @example createJobDispatcher({ middleware: [tenant()] });
 */
export function tenant(): JobMiddleware<{
	key: typeof TenantNamespace;
	value: DurableObjectNamespace<TenantObject>;
	property: "tenant";
}> {
	return async (ctx, next) => {
		ctx.set(TenantNamespace, env.TENANT, { property: "tenant" });
		await next();
	};
}
