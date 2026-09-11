/**
 * Job middleware that opens the identity provider's management client and publishes it on
 * the context, so a handler reads `ctx.admin` and a test hands in one that answers from a
 * script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@sdxc/auth/management-client";
import type { JobMiddleware } from "@sdxc/jobs";

import { createContextKey } from "remix/router";

import { createManagementClient } from "~/app/lib/management-client";

/** Where a job's management client lives on the context, installed as `ctx.admin`. */
export const Admin = createContextKey<ManagementClient>();

/** What {@link admin} publishes, which is what types `ctx.admin` for handlers. */
export type AdminEffect = {
	key: typeof Admin;
	value: ManagementClient;
	property: "admin";
};

/**
 * Publishes the management client for the job about to run.
 *
 * @returns The middleware, for a dispatcher's chain.
 * @example createJobDispatcher({ middleware: [costLedger(), database(), admin()] });
 */
export function admin(): JobMiddleware<AdminEffect> {
	return async (ctx, next) => {
		ctx.set(Admin, createManagementClient(), { property: "admin" });
		await next();
	};
}
