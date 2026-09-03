/**
 * The middleware chain a dispatcher runs every job inside, and the types that carry
 * what each middleware publishes into the context. The effect a middleware
 * declares rides along as type-only metadata, so an inline `middleware: [...]`
 * array is enough for a handler to see `ctx.database` with its real type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext } from "./context";

/** Runs the rest of the chain, ending in the job's handler. */
export type NextFunction = () => Promise<void>;

/** What one middleware puts into the context, and the property it installs it as. */
export interface ContextEffect {
	key: object;
	value: unknown;
	property?: string;
}

/** A middleware that publishes nothing a handler can read off the context. */
export interface EmptyContextEffect {
	key: never;
	value: never;
}

/** Type-only slot carrying a middleware's declared effect. */
declare const contextEffect: unique symbol;

/**
 * Runs around every job, in the order declared. Must call `next()`; a middleware
 * that returns without calling it never reaches the handler.
 *
 * @example
 * function database(): JobMiddleware<{ key: typeof Database; value: DB; property: "database" }> {
 * 	return async (ctx, next) => {
 * 		ctx.set(Database, connect(), { property: "database" });
 * 		await next();
 * 	};
 * }
 */
export type JobMiddleware<Effect extends ContextEffect = EmptyContextEffect> = ((
	context: AnyJobContext,
	next: NextFunction,
) => void | Promise<void>) & {
	/** Type-only metadata naming what this middleware publishes. */
	readonly [contextEffect]?: Effect | undefined;
};

/** A middleware whatever it publishes, for the places that hold a whole chain. */
// oxlint-disable-next-line typescript/no-explicit-any -- effects vary per middleware
export type AnyJobMiddleware = JobMiddleware<any>;

/** The effect one middleware declared, or nothing when it declared none. */
type EffectOf<Middleware> = Middleware extends {
	readonly [contextEffect]?: (infer Effect) | undefined;
}
	? Effect extends ContextEffect
		? Effect
		: never
	: never;

/** Installs nothing a handler can read: an intersection with this changes no type. */
type NoProperties = Record<never, never>;

/** The property one effect installs, ignoring an effect that installs none. */
type PropertyOf<Effect> = Effect extends {
	property: infer Property extends string;
	value: infer Value;
}
	? string extends Property
		? NoProperties
		: { readonly [Key in Property]: Value }
	: NoProperties;

/**
 * Every property a chain installs, folded left to right so a later middleware
 * overriding a name wins. A chain that is a plain array rather than a tuple
 * carries no order, so it contributes nothing.
 */
export type ChainProperties<Chain extends readonly AnyJobMiddleware[]> =
	number extends Chain["length"]
		? NoProperties
		: Chain extends readonly [infer First, ...infer Rest extends readonly AnyJobMiddleware[]]
			? Omit<PropertyOf<EffectOf<First>>, keyof ChainProperties<Rest>> & ChainProperties<Rest>
			: NoProperties;
