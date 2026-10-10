/**
 * The middleware an `@sdxc/jobs` dispatcher runs to publish a bound registry as `ctx.models`,
 * so a job handler reads models the way a route handler does, bound to the database the job's
 * own middleware chain published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext, JobMiddleware } from "@sdxc/jobs";

import type { ModelRegistry } from "./registry.js";
import type { BindOptions, BoundModels, ModelContextInit, RegistryEntries } from "./types.js";

import { Models } from "./context.js";
import { bindLazily } from "./registry.js";

export { Models } from "./context.js";

/** How the middleware publishes the registry. */
export interface ModelsJobMiddlewareOptions<Property extends string> extends BindOptions {
	/**
	 * The context property the bound registry installs as.
	 *
	 * @default "models"
	 */
	property?: Property;
}

/**
 * Publishes the registry bound to each job run. `context` runs once, on the first model
 * access, so it reads whatever earlier middleware published; a run that touches no model never
 * runs it.
 *
 * @param registry The app's models.
 * @param context Builds the model context from the job context.
 * @param options The property name and whether the database has real transactions.
 * @returns The middleware installing the bound registry as `ctx.models`.
 * @example createJobDispatcher({ middleware: [database(), models(registry, (ctx) => ({ db: ctx.database }))] });
 */
export function models<Entries extends RegistryEntries, const Property extends string = "models">(
	registry: ModelRegistry<Entries>,
	context: (ctx: AnyJobContext) => ModelContextInit,
	options?: ModelsJobMiddlewareOptions<Property>,
): JobMiddleware<{ key: typeof Models; value: BoundModels<Entries>; property: Property }> {
	let property = { property: options?.property ?? "models" };

	return async (ctx, next) => {
		ctx.set(Models, bindLazily(registry, () => context(ctx), ctx, options) as never, property);
		await next();
	};
}
