/**
 * The middleware a `remix/router` router installs to publish a bound registry as `ctx.models`.
 * MCP tools and resources run on the request's own context, so a tool mounted on the router
 * reads the same models a route handler does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import type { ModelRegistry } from "./registry.js";
import type { BindOptions, BoundModels, ModelContextInit, RegistryEntries } from "./types.js";

import { Models } from "./context.js";
import { bindLazily } from "./registry.js";

export { Models } from "./context.js";

/** How the middleware publishes the registry. */
export interface ModelsMiddlewareOptions<Property extends string> extends BindOptions {
	/**
	 * The context property the bound registry installs as.
	 *
	 * @default "models"
	 */
	property?: Property;
}

/**
 * Publishes the registry bound to each request. `context` runs once, on the first model access,
 * so it reads whatever earlier middleware published, such as the tenant's database; a request
 * that touches no model never runs it and binds nothing.
 *
 * @param registry The app's models.
 * @param context Builds the model context from the request context.
 * @param options The property name and whether the database has real transactions.
 * @returns The middleware installing the bound registry as `ctx.models`.
 * @example router.use(models(registry, (ctx) => ({ db: ctx.db, log: ctx.log })));
 */
export function models<Entries extends RegistryEntries, const Property extends string = "models">(
	registry: ModelRegistry<Entries>,
	context: (ctx: RequestContext) => ModelContextInit,
	options?: ModelsMiddlewareOptions<Property>,
): Middleware<{ key: typeof Models; value: BoundModels<Entries>; property: Property }> {
	let property = { property: options?.property ?? "models" };

	return (ctx, next) => {
		ctx.set(Models, bindLazily(registry, () => context(ctx), ctx, options) as never, property);
		return next();
	};
}
