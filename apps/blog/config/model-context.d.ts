/**
 * What the blog's model callbacks read besides the database: the rest of the registry, bound
 * to the same request or job, so a callback reaching another model is type-checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BoundRegistry } from "@sdxc/data-model";

import type { models } from "~/app/models";

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: BoundRegistry<typeof models>;
	}
}

export {};
