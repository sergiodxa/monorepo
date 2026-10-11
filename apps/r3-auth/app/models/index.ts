/**
 * The authorization server's models, bound per request and per job as `ctx.models`. Each
 * entry imports its module on first use, so an invocation evaluates only the models it
 * touches, the way routes load only the controllers a request reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundModels } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

import type { Clients } from "./clients";
import type { Connections } from "./connections";
import type { Credentials } from "./credentials";
import type { Grants } from "./grants";
import type { Sessions } from "./sessions";
import type { Subjects } from "./subjects";

export const models = createModels({
	subjects: () => import("./subjects"),
	credentials: () => import("./credentials"),
	connections: () => import("./connections"),
	clients: () => import("./clients"),
	grants: () => import("./grants"),
	sessions: () => import("./sessions"),
});

/**
 * Every registry entry by name. Typing the bound registry from this interface resolves each
 * model only when it is read, so a model method can reach a sibling through
 * `this.context.models` and keep every model typed.
 */
export interface AuthModelEntries {
	subjects: typeof Subjects;
	credentials: typeof Credentials;
	connections: typeof Connections;
	clients: typeof Clients;
	grants: typeof Grants;
	sessions: typeof Sessions;
}

/** The registry bound to one request or job, for code handed `ctx.models`. */
export type AuthModels = BoundModels<AuthModelEntries>;
