/**
 * `createCommand()`, which pairs a handler with the command it runs. Passing the declaration is
 * what types `ctx.arguments` and `ctx.flags`; the middleware listed beside the handler, and the
 * CLI's own when an app augments {@link CLITypes}, type what they publish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ArgumentsOf, FlagsOf, Node } from "./command.js";
import type { AnyCommandContext, CommandContext } from "./context.js";
import type { Carried } from "./flag.js";
import type { AnyCommandMiddleware, ChainProperties, CommandResult } from "./middleware.js";

/**
 * Augmented by an app to name its CLI, so handlers written in their own files read what the
 * CLI's middleware publishes, the way `JobTypes` does for jobs.
 *
 * @example
 * declare module "@sdxc/cli" {
 * 	interface CLITypes {
 * 		cli: typeof cli;
 * 	}
 * }
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- the seam apps augment
export interface CLITypes {}

/** The middleware chain of the CLI an app named in {@link CLITypes}. */
type CurrentChain = CLITypes extends { cli: { readonly middleware: infer Chain } }
	? Chain extends readonly AnyCommandMiddleware[]
		? Chain
		: []
	: [];

/** The context a command's handler receives, with what its middleware chain installed. */
export type HandlerContext<
	Target,
	Chain extends readonly AnyCommandMiddleware[] = [],
	Global extends readonly AnyCommandMiddleware[] = CurrentChain,
> = CommandContext<ArgumentsOf<Target>, FlagsOf<Target>> &
	ChainProperties<Global> &
	ChainProperties<Chain>;

/**
 * The context of any command that runs behind `Chain`, whatever it parsed: the type a helper
 * shared by several commands takes, since each command's own context is assignable to it.
 *
 * @example
 * const MAKE = [project(), packageRoot()] as const;
 * function write(ctx: ChainContext<typeof MAKE>, file: string) { ctx.project.root; }
 */
export type ChainContext<
	Chain extends readonly AnyCommandMiddleware[] = [],
	Global extends readonly AnyCommandMiddleware[] = CurrentChain,
> = AnyCommandContext & ChainProperties<Global> & ChainProperties<Chain>;

/** The work itself: a success exits 0 and a failure exits by its kind. */
export type CommandHandler<Context> = (context: Context) => CommandResult | Promise<CommandResult>;

/** Brands a command implementation so `map()` can tell it from a bare handler. */
const ACTION = Symbol.for("@sdxc/cli.action");

/** Type-only slot naming the command an action was written for. */
declare const TARGET: unique symbol;

/** A handler paired with the middleware that runs before it alone. */
export interface CommandAction<
	Target = Node,
	Chain extends readonly AnyCommandMiddleware[] = readonly AnyCommandMiddleware[],
> {
	readonly [ACTION]: true;
	readonly [TARGET]?: Carried<Target>;
	readonly middleware: Chain;
	/** The work itself; a method, so an action written for one chain maps wherever its command does. */
	handler(
		this: void,
		context: HandlerContext<Target, Chain>,
	): CommandResult | Promise<CommandResult>;
}

/** Whether `value` is what `createCommand` returns. */
export function isAction(
	value: unknown,
): value is CommandAction<Node, readonly AnyCommandMiddleware[]> {
	return typeof value === "object" && value !== null && ACTION in value;
}

/**
 * Types one command's implementation against its declaration, so it can live in its own file
 * and be mapped through `lazy()`.
 *
 * @param target - The declared command (or group) this implements
 * @param action - The handler, or `{ middleware, handler }` for middleware that runs before
 * this command alone
 * @example export default createCommand(sdxc.ui.add, async (ctx) => success());
 * @example export default createCommand(sdxc.make.job, { middleware: [project()], handler: (ctx) => make(ctx.project) });
 */
export function createCommand<
	Target extends Node,
	const Chain extends readonly AnyCommandMiddleware[] = [],
>(
	target: Target,
	action:
		| CommandHandler<HandlerContext<Target, Chain>>
		| { middleware: Chain; handler: CommandHandler<HandlerContext<Target, Chain>> },
): CommandAction<Target, Chain> {
	if (typeof action === "function") {
		return { [ACTION]: true, middleware: [] as unknown as Chain, handler: action };
	}
	return { [ACTION]: true, middleware: action.middleware, handler: action.handler };
}
