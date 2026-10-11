/**
 * What the authorization server's model callbacks read besides the database: the rest of the
 * registry, bound to the same request or job, so a callback or method reaching another model
 * through `this.context.models` is type-checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthModels } from "~/app/models";

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: AuthModels;
	}
}

export {};
