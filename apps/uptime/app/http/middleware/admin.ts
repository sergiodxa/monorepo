/**
 * Publishes the identity provider's management client as `ctx.admin`, for the one surface
 * that shows more of a team member than the signed-in viewer's own claims carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@sdxc/auth/management-client";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

/** Where the management client lives on a request context. */
export const Admin = createContextKey<ManagementClient>();

declare module "remix/router" {
	interface RequestContext {
		/** Reads other subjects' profiles, published by the global `admin()` middleware. */
		admin: ManagementClient;
	}
}

/**
 * Publishes the management client for the request about to run.
 *
 * @param source - Opens the client, called per request so its credentials are read when
 * one arrives rather than when this module loads.
 * @returns The middleware, for a router's chain.
 * @example
 * let router = createRouter({ middleware: [admin(createManagementClient)] });
 */
export function admin(source: () => ManagementClient): Middleware {
	return (ctx, next) => {
		ctx.set(Admin, source(), { property: "admin" });
		return next();
	};
}
