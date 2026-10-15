/**
 * The `sdxc make` handlers: one per kind, each reading only the flags its kind declares, one for
 * `make stubs`, and one for `make` alone, which asks for the kind and the name on a terminal.
 * `createSDXC()` maps each named export through `lazy()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { MakeContext, MakeInput } from "../make/index.js";
import type { KindName } from "../make/kinds.js";
import type { Project } from "../middleware.js";

import { METHODS, SDXC_COMMANDS } from "../contract.js";
import { make } from "../make/index.js";
import { KINDS } from "../make/kinds.js";
import { copyStubs } from "../make/stubs.js";
import { packageRoot, project } from "../middleware.js";

/** What every `make` handler reads besides its own command's input. */
type Shared = MakeContext & { readonly project: Project; readonly packageRoot: string };

/** The middleware every `make` handler runs behind. */
function chain() {
	return [project(), packageRoot()] as const;
}

/** Makes one file of `input.kind` in the project the middleware found. */
async function run(ctx: Shared, input: MakeInput) {
	let made = await make(ctx, ctx.project, ctx.packageRoot, input);
	if (isFailure(made)) return made;
	return success();
}

/** `sdxc make controller`, which declares the route and maps the controller. */
export const controller = createCommand(SDXC_COMMANDS.make.controller, {
	middleware: chain(),
	/** Asks for the method on a terminal, with `get` preselected. */
	handler: (ctx) =>
		run(ctx, {
			kind: "controller",
			name: ctx.arguments.name,
			method: ctx.flags.method,
			path: ctx.flags.path,
			routes: ctx.flags.routes,
			test: ctx.flags.test,
			dryRun: ctx.flags.dryRun,
		}),
});

/** `sdxc make job`, which declares the job and maps its handler. */
export const job = createCommand(SDXC_COMMANDS.make.job, {
	middleware: chain(),
	/** `--cron` writes a scheduled job. */
	handler: (ctx) =>
		run(ctx, {
			kind: "job",
			name: ctx.arguments.name,
			cron: ctx.flags.cron,
			test: ctx.flags.test,
			dryRun: ctx.flags.dryRun,
		}),
});

/** `sdxc make mcp`, which declares the tool or resource and maps its handler. */
export const mcp = createCommand(SDXC_COMMANDS.make.mcp, {
	middleware: chain(),
	/** `--resource` writes a resource instead of a tool. */
	handler: (ctx) =>
		run(ctx, {
			kind: "mcp",
			name: ctx.arguments.name,
			resource: ctx.flags.resource,
			test: ctx.flags.test,
			dryRun: ctx.flags.dryRun,
		}),
});

/** `sdxc make migration`, numbered within its chain. */
export const migration = createCommand(SDXC_COMMANDS.make.migration, {
	middleware: chain(),
	/** `--chain` picks one of `make.migrations`. */
	handler: (ctx) =>
		run(ctx, {
			kind: "migration",
			name: ctx.arguments.name,
			chain: ctx.flags.chain,
			test: false,
			dryRun: ctx.flags.dryRun,
		}),
});

/** `sdxc make factory`, which writes no test. */
export const factory = createCommand(SDXC_COMMANDS.make.factory, {
	middleware: chain(),
	/** Writes the factory alone. */
	handler: (ctx) =>
		run(ctx, { kind: "factory", name: ctx.arguments.name, test: false, dryRun: ctx.flags.dryRun }),
});

/**
 * A handler for a kind that takes only `--test` and `--dry-run`.
 *
 * @param kind - The kind it writes
 */
function plain<
	Kind extends
		| "middleware"
		| "validator"
		| "model"
		| "service"
		| "policy"
		| "initializer"
		| "email",
>(kind: Kind) {
	return createCommand(SDXC_COMMANDS.make[kind], {
		middleware: chain(),
		/** Writes the file and, unless `--no-test` or `make.tests` says otherwise, its test. */
		handler: (ctx) =>
			run(ctx, {
				kind,
				name: ctx.arguments.name,
				test: ctx.flags.test,
				dryRun: ctx.flags.dryRun,
			}),
	});
}

/** `sdxc make middleware`. */
export const middleware = plain("middleware");

/** `sdxc make validator`. */
export const validator = plain("validator");

/** `sdxc make model`. */
export const model = plain("model");

/** `sdxc make service`. */
export const service = plain("service");

/** `sdxc make policy`. */
export const policy = plain("policy");

/** `sdxc make initializer`. */
export const initializer = plain("initializer");

/** `sdxc make email`. */
export const email = plain("email");

/** `sdxc make stubs`, which copies the built-in stubs of the named kinds, or every kind. */
export const stubs = createCommand(SDXC_COMMANDS.make.stubs, {
	middleware: chain(),
	/** Prints each stub written, and each one kept because the project already edits it. */
	async handler(ctx) {
		let copied = await copyStubs(
			ctx.arguments.kinds,
			ctx.project.root,
			ctx.project.config.make.stubs,
			ctx.packageRoot,
		);
		if (isFailure(copied)) return copied;
		for (let path of copied.data.written) ctx.stdout(`Wrote ${path}\n`);
		for (let path of copied.data.kept) ctx.stdout(`Kept ${path}, which already exists\n`);
		return success();
	},
});

/**
 * `sdxc make` with no kind: on a terminal, asks for the kind, the name and, for a controller,
 * the method, then makes it with every other flag at its default. Without a terminal it is a
 * usage error, which prints the list of kinds.
 */
export const group = createCommand(SDXC_COMMANDS.make, {
	middleware: chain(),
	/** Exits 2 when no kind or name is given. */
	async handler(ctx) {
		let kind = await ctx.prompt.select<KindName | null>({
			message: "What should sdxc make?",
			options: (Object.keys(KINDS) as KindName[]).map((value) => ({ value })),
			default: null,
			name: "kind",
		});
		if (isFailure(kind)) return kind;
		if (kind.data === null) return usage("Name a kind to make");
		let name = await ctx.prompt.text({
			message: `What should the ${kind.data} be called?`,
			default: "",
			name: "name",
		});
		if (isFailure(name)) return name;
		if (name.data.trim() === "") return usage(`Name the ${kind.data} to make`);
		let method: string | undefined;
		if (kind.data === "controller") {
			let picked = await ctx.prompt.select<string>({
				message: "Which method?",
				options: METHODS,
				default: "get",
				name: "method",
			});
			if (isFailure(picked)) return picked;
			method = picked.data;
		}
		return run(ctx, { kind: kind.data, name: name.data, method, test: undefined, dryRun: false });
	},
});
