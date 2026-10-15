/**
 * `createCLI()`: a command contract with handlers mapped onto it, run against an argument
 * vector. A run parses, prints help or a usage error, asks for what is missing, runs the
 * middleware chain and the handler, and answers the exit code its outcome maps to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, isFailure, success } from "@sdxc/result";

import type { ArgumentsOf, FlagsOf, Group, Node } from "./command.js";
import type { CommandAction, CommandHandler } from "./handler.js";
import type { Lazy } from "./lazy.js";
import type { AnyCommandMiddleware, ChainProperties, CommandResult } from "./middleware.js";
import type { RunIO, Script, Session } from "./session.js";
import type { Entry, Tree } from "./tree.js";

import { CommandContext } from "./context.js";
import { CancelledError, EXIT_CODES, exitCodeOf, UsageError } from "./errors.js";
import { isAction } from "./handler.js";
import { renderHelp } from "./help.js";
import { isLazy } from "./lazy.js";
import { parseArgv } from "./parse.js";
import { createPrompter, resolveInputs } from "./resolve.js";
import { openSession } from "./session.js";
import { buildTree } from "./tree.js";

/** What a CLI is built from. */
export interface CLIOptions<Commands extends Group, Chain extends readonly AnyCommandMiddleware[]> {
	/** The program name, as the usage line prints it. */
	name: string;
	/** Printed by `--version`; without one the flag does not exist. */
	version?: string;
	/** Shown under the root usage line when the root group has no description. */
	description?: string;
	commands: Commands;
	/** Runs before every command's own middleware, in order. */
	middleware?: Chain;
}

/** What `map()` accepts for one command or group. */
export type Binding<Target, Chain extends readonly AnyCommandMiddleware[]> =
	| CommandHandler<CommandContext<ArgumentsOf<Target>, FlagsOf<Target>> & ChainProperties<Chain>>
	// oxlint-disable-next-line typescript/no-explicit-any -- an action carries whatever chain it was written with
	| CommandAction<Target, any>
	// oxlint-disable-next-line typescript/no-explicit-any -- an action carries whatever chain it was written with
	| Lazy<CommandAction<Target, any>>;

/** A command line: its contract, the handlers mapped onto it, and a way to run it. */
export interface CLI<
	Commands extends Group = Group,
	Chain extends readonly AnyCommandMiddleware[] = readonly AnyCommandMiddleware[],
> {
	readonly name: string;
	readonly version: string | undefined;
	readonly commands: Commands;
	readonly middleware: Chain;
	/**
	 * Binds a handler to a command. A group can be mapped too; it runs when the command line
	 * names the group and no member, which otherwise prints the group's help.
	 *
	 * @throws Error When the target is not in this CLI's contract, or is mapped twice.
	 */
	map<Target extends Node>(target: Target, binding: Binding<Target, Chain>): void;
	/**
	 * Runs the command `argv` names and answers its exit code: 0 success, 1 failure, 2 usage
	 * error, 130 cancelled, or the code an `exit()` failure carries.
	 *
	 * @param argv - The arguments after the program, as `process.argv.slice(2)` holds them
	 * @param io - Replaces any part of the process the run uses
	 * @example process.exitCode = await cli.run(process.argv.slice(2));
	 */
	run(argv: readonly string[], io?: RunIO): Promise<number>;
}

/** What a CLI keeps for itself and its test harness. */
interface Internals {
	tree: Tree;
	options: CLIOptions<Group, readonly AnyCommandMiddleware[]>;
	bindings: Map<Node, () => Promise<CommandAction>>;
}

/** Every CLI's internals, reachable by the test harness without being part of the API. */
const INTERNALS = new WeakMap<object, Internals>();

/**
 * Builds a CLI over a command contract.
 *
 * @throws Error When the contract repeats a command, gives a flag a reserved or duplicate name,
 * or puts a variadic argument before another one.
 * @example
 * let cli = createCLI({ name: "sdxc", version, commands: sdxc, middleware: [project()] });
 * cli.map(sdxc.init, lazy(() => import("./commands/init.js")));
 * process.exitCode = await cli.run(process.argv.slice(2));
 */
export function createCLI<
	Commands extends Group,
	const Chain extends readonly AnyCommandMiddleware[] = [],
>(options: CLIOptions<Commands, Chain>): CLI<Commands, Chain> {
	let tree = buildTree(options.name, options.commands);
	let bindings = new Map<Node, () => Promise<CommandAction>>();
	let cli: CLI<Commands, Chain> = {
		name: options.name,
		version: options.version,
		commands: options.commands,
		middleware: options.middleware ?? ([] as unknown as Chain),
		map(target, binding) {
			let entry = tree.entries.get(target);
			if (entry === undefined) throw new Error(`map() was given a command outside ${options.name}`);
			if (bindings.has(target)) throw new Error(`${entry.title} is mapped twice`);
			bindings.set(target, resolver(binding));
		},
		run: (argv, io = {}) => execute(cli, argv, io, undefined),
	};
	INTERNALS.set(cli, {
		tree,
		options: options as unknown as CLIOptions<Group, readonly AnyCommandMiddleware[]>,
		bindings,
	});
	return cli;
}

/** A binding as a loader of its action, importing a lazy one at most once per CLI. */
function resolver(binding: unknown): () => Promise<CommandAction> {
	if (isLazy(binding)) {
		let loading: Promise<CommandAction> | undefined;
		return () => {
			loading ??= binding.load().then(
				(module) => normalize(module.default),
				(error: unknown) => {
					loading = undefined;
					throw error;
				},
			);
			return loading;
		};
	}
	let action = normalize(binding);
	return () => Promise.resolve(action);
}

/** An action, or a bare handler wrapped as one with no middleware of its own. */
function normalize(binding: unknown): CommandAction {
	if (isAction(binding)) return binding as unknown as CommandAction;
	return { middleware: [], handler: binding } as unknown as CommandAction;
}

/**
 * Runs `argv` on `cli` with a test's script. Used by `@sdxc/cli/test`.
 *
 * @internal
 */
export function runScripted<Commands extends Group, Chain extends readonly AnyCommandMiddleware[]>(
	cli: CLI<Commands, Chain>,
	argv: readonly string[],
	io: RunIO,
	script: Script,
): Promise<number> {
	return execute(cli, argv, io, script);
}

/** One run, from argument vector to exit code. */
async function execute(
	cli: object,
	argv: readonly string[],
	io: RunIO,
	script: Script | undefined,
): Promise<number> {
	let internals = INTERNALS.get(cli) as Internals;
	let { tree, options, bindings } = internals;
	let program = { version: options.version, description: options.description };
	let parsed = parseArgv(tree, argv, options.version !== undefined);
	let session = openSession(io, parsed.noProgress, script);
	try {
		let entry = parsed.entry;
		if (parsed.help) {
			session.stdout.write(renderHelp(entry, program, session.style));
			return EXIT_CODES.success;
		}
		if (parsed.version) {
			session.stdout.write(`${options.version}\n`);
			return EXIT_CODES.success;
		}
		if (parsed.issues.length > 0 && entry.children.size > 0) {
			return report(new UsageError(parsed.issues.join("\n")), entry, session, program);
		}
		let load = bindings.get(entry.node);
		if (load === undefined) {
			if (entry.children.size > 0) {
				session.stderr.write(renderHelp(entry, program, session.style.stderr));
				return EXIT_CODES.usage;
			}
			return report(new Error(`${entry.title} has no handler`), entry, session, program);
		}
		let inputs = await resolveInputs(parsed, session);
		if (isFailure(inputs)) return report(inputs.error, entry, session, program);
		let action: CommandAction;
		try {
			action = await load();
		} catch (error) {
			return report(asError(error), entry, session, program);
		}
		let context = new CommandContext({
			argv: [...argv],
			path: entry.path,
			arguments: inputs.data.arguments,
			flags: inputs.data.flags,
			session,
			prompt: createPrompter(session),
		});
		let chain = [...(options.middleware ?? []), ...action.middleware];
		let outcome = await dispatch(chain, context, action.handler as CommandHandler<CommandContext>);
		if (isFailure(outcome)) return report(outcome.error, entry, session, program);
		return EXIT_CODES.success;
	} finally {
		session.close();
	}
}

/**
 * Runs the middleware chain and the handler. A thrown error becomes a failure, so a bug in a
 * handler still exits 1 with its message.
 */
async function dispatch(
	chain: readonly AnyCommandMiddleware[],
	context: CommandContext,
	handler: CommandHandler<CommandContext>,
): Promise<CommandResult> {
	/** Runs the chain from `index`, answering the outcome the run exits with. */
	let run = async (index: number): Promise<CommandResult> => {
		let middleware = chain[index];
		if (middleware === undefined) return handler(context);
		let downstream: CommandResult | undefined;
		let returned = await middleware(context, async () => {
			downstream = await run(index + 1);
			return downstream;
		});
		if (returned !== undefined && (downstream === undefined || isFailure(returned))) {
			return returned;
		}
		return downstream ?? success(undefined);
	};
	let outcome: CommandResult;
	try {
		outcome = await run(0);
	} catch (error) {
		return failure(asError(error));
	}
	if (context.signal.aborted && isFailure(outcome)) return failure(new CancelledError());
	return outcome;
}

/** A thrown value as an `Error`. */
function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

/** Prints a failed run's message and answers its exit code. */
function report(
	error: Error,
	entry: Entry,
	session: Session,
	program: { version: string | undefined; description: string | undefined },
): number {
	if (error instanceof UsageError) {
		let help = renderHelp(entry, program, session.style.stderr);
		session.screen.write(session.stderr, `${error.message}\n\n${help}`);
	} else if (!(error instanceof CancelledError) && error.message !== "") {
		session.screen.write(session.stderr, `${error.message}\n`);
	}
	return exitCodeOf(error);
}
