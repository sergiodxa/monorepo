/**
 * The middleware chain a CLI runs every command inside, and the types that carry what each
 * middleware publishes into the context. The effect a middleware declares rides along as
 * type-only metadata, so an inline `middleware: [...]` array is enough for a handler to read
 * `ctx.db` with its real type; the shape matches `@sdxc/jobs`, so one package ships both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import type { AnyCommandContext } from "./context.js";

/** What a command answers: success exits 0, a failure exits by its kind. */
export type CommandResult = Result<unknown, Error>;

/** Runs the rest of the chain, ending in the command's handler. */
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
 * Runs before the command's handler, in the order declared. It calls `next()` to continue; one
 * that returns a failure instead ends the run with it, the way a handler's failure does, and one
 * that returns without calling `next()` ends the run successfully without the handler.
 *
 * @example
 * function project(): CommandMiddleware<{ key: typeof Project; value: Root; property: "project" }> {
 * 	return async (ctx, next) => {
 * 		let root = await findProjectRoot(ctx.cwd);
 * 		if (isFailure(root)) return root;
 * 		ctx.set(Project, root.data, { property: "project" });
 * 		await next();
 * 	};
 * }
 */
export type CommandMiddleware<Effect extends ContextEffect = EmptyContextEffect> = ((
	context: AnyCommandContext,
	next: NextFunction,
) => void | CommandResult | Promise<void | CommandResult>) & {
	/** Type-only metadata naming what this middleware publishes. */
	readonly [contextEffect]?: Effect | undefined;
};

/** A middleware whatever it publishes, for the places that hold a whole chain. */
// oxlint-disable-next-line typescript/no-explicit-any -- effects vary per middleware
export type AnyCommandMiddleware = CommandMiddleware<any>;

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
 * Every property a chain installs, folded left to right so a later middleware overriding a name
 * wins. A chain that is a plain array rather than a tuple carries no order, so it contributes
 * nothing.
 */
export type ChainProperties<Chain extends readonly AnyCommandMiddleware[]> =
	number extends Chain["length"]
		? NoProperties
		: Chain extends readonly [infer First, ...infer Rest extends readonly AnyCommandMiddleware[]]
			? Omit<PropertyOf<EffectOf<First>>, keyof ChainProperties<Rest>> & ChainProperties<Rest>
			: NoProperties;
