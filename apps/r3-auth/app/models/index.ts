/**
 * The authorization server's models, bound per request and per job as `ctx.models`. Each
 * entry imports its module on first use, so an invocation evaluates only the models it
 * touches, the way routes load only the controllers a request reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

export const models = createModels({
	subjects: () => import("./subjects"),
	credentials: () => import("./credentials"),
	connections: () => import("./connections"),
	clients: () => import("./clients"),
	grants: () => import("./grants"),
	sessions: () => import("./sessions"),
});

/** The registry bound to one request or job, for code handed `ctx.models`. */
export type AuthModels = BoundRegistry<typeof models>;
