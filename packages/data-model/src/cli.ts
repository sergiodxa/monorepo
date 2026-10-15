/**
 * The middleware an `@sdxc/cli` command line runs to publish a bound registry as `ctx.models`,
 * so a command handler reads models the way a route or job handler does, bound to the database
 * the command's own middleware chain published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyCommandContext, CommandMiddleware } from "@sdxc/cli";

import type { ModelRegistry } from "./registry.js";
import type { BindOptions, BoundModels, RegistryContextInit, RegistryEntries } from "./types.js";

import { Models } from "./context.js";
import { bindLazily } from "./registry.js";

export { Models } from "./context.js";

/** How the middleware publishes the registry. */
export interface ModelsCommandMiddlewareOptions<Property extends string> extends BindOptions {
	/**
	 * The context property the bound registry installs as.
	 *
	 * @default "models"
	 */
	property?: Property;
}

/**
 * Publishes the registry bound to each command run. `context` runs once, on the first model
 * access, so it reads whatever earlier middleware published; a run that touches no model never
 * runs it.
 *
 * @param registry The app's models.
 * @param context Builds the model context from the command context.
 * @param options The property name and whether the database has real transactions.
 * @returns The middleware installing the bound registry as `ctx.models`.
 * @example createCLI({ name: "app", commands, middleware: [database(db), models(registry, (ctx) => ({ db: ctx.db }))] });
 */
export function models<Entries extends RegistryEntries, const Property extends string = "models">(
	registry: ModelRegistry<Entries>,
	context: (ctx: AnyCommandContext) => RegistryContextInit<Entries>,
	options?: ModelsCommandMiddlewareOptions<Property>,
): CommandMiddleware<{ key: typeof Models; value: BoundModels<Entries>; property: Property }> {
	let property = { property: options?.property ?? "models" };

	return async (ctx, next) => {
		ctx.set(Models, bindLazily(registry, () => context(ctx), ctx, options) as never, property);
		await next();
	};
}
