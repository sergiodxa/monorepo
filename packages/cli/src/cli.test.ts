/**
 * Tests for the runtime: generated help at every level, `--version`, mapping and lazy
 * handlers, middleware publishing onto the context, and the exit code of every outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { ExecRequest } from "./exec.js";
import type { ChainContext } from "./handler.js";
import type { CommandMiddleware } from "./middleware.js";

import { argument } from "./argument.js";
import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { exit, exitCodeOf, success, usage } from "./errors.js";
import { flag } from "./flag.js";
import { createCommand } from "./handler.js";
import { lazy } from "./lazy.js";
import { prompt } from "./prompt.js";
import { invoke } from "./test.js";

/** A small program with a group, a command and every help element. */
const CONTRACT = commands({
	init: command({
		description: "Write the config file",
		flags: { dryRun: flag.boolean("dry-run", { description: "Print it and write nothing" }) },
	}),
	ui: commands({
		description: "Copy components into the project",
		add: command({
			description: "Copy components",
			arguments: { components: argument.variadic(s.string(), { min: 1, description: "Names" }) },
			flags: {
				withDeps: flag.boolean("with-deps", { description: "Copy what they reach too" }),
				template: flag.string("template", {
					default: "app",
					valueName: "name",
					description: "Template",
				}),
				git: flag.boolean("git", { prompt: prompt.confirm({ message: "Initialize git?" }) }),
				install: flag.boolean("install", { default: true, description: "Install dependencies" }),
				color: flag.boolean("color", { default: undefined, description: "Colour the output" }),
				allowNet: flag
					.string("allow-net", { valueName: "host", heading: "Permissions" })
					.optionalValue()
					.list(),
			},
			examples: ["ui add button dialog"],
			tasks: true,
		}),
		list: command({ description: "List components", hidden: true }),
	}),
});

/** The project root a middleware publishes. */
const Project = createContextKey<string>();

/** Publishes the project root as `ctx.project`. */
function project(): CommandMiddleware<{ key: typeof Project; value: string; property: "project" }> {
	return async (ctx, next) => {
		if (ctx.env.NO_PROJECT === "1") return failure(new Error("No project found"));
		ctx.set(Project, `${ctx.cwd}/root`, { property: "project" });
		await next();
	};
}

describe("help", () => {
	test("renders the root, a group and a command from the contract", async () => {
		let cli = createCLI({ name: "sdxc", version: "2026.10.15", commands: CONTRACT });

		let root = await invoke(cli, ["--help"]);
		let group = await invoke(cli, ["ui", "-h"]);
		let leaf = await invoke(cli, ["ui", "add", "--help"]);

		expect(root.code).toBe(0);
		expect(root.stdout).toBe(
			[
				"Usage: sdxc <command> [options]",
				"",
				"Commands:",
				"  init  Write the config file",
				"  ui    Copy components into the project",
				"",
				"Options:",
				"  --version   Print the version",
				"  -h, --help  Show this help",
				"",
			].join("\n"),
		);
		expect(group.stdout).toContain("Usage: sdxc ui <command> [options]");
		expect(group.stdout).toContain("  add  Copy components");
		expect(group.stdout).not.toContain("list");
		expect(leaf.stdout).toBe(
			[
				"Usage: sdxc ui add <components...> [options]",
				"",
				"Copy components",
				"",
				"Arguments:",
				"  <components...>  Names",
				"",
				"Options:",
				"  --with-deps        Copy what they reach too",
				"  --template <name>  Template (default: app)",
				"  --[no-]git",
				"  --no-install       Install dependencies",
				"  --[no-]color       Colour the output",
				"  --no-progress      Print tasks without animation",
				"  -h, --help         Show this help",
				"",
				"Permissions:",
				"  --allow-net[=<host,...>]",
				"",
				"Examples:",
				"  sdxc ui add button dialog",
				"",
			].join("\n"),
		);
	});

	test("lists --no-progress only for a command that runs tasks", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });

		let init = await invoke(cli, ["init", "--help"]);

		expect(init.stdout).not.toContain("--no-progress");
		expect(init.stdout).toContain("--dry-run");
	});

	test("prints a group's own arguments and flags beside its members", async () => {
		let contract = commands({
			make: commands({
				description: "Make a file",
				arguments: { kind: argument(s.string(), { description: "What to make" }) },
				flags: { dryRun: flag.boolean("dry-run") },
				job: command({ description: "A job" }),
			}),
		});
		let cli = createCLI({ name: "sdxc", commands: contract });

		let help = await invoke(cli, ["make", "--help"]);

		expect(help.stdout).toContain(
			"Usage: sdxc make <command> [options]\n       sdxc make <kind> [options]\n",
		);
		expect(help.stdout).toContain("  <kind>  What to make");
		expect(help.stdout).toContain("  --dry-run");
	});

	test("prints --version at the root only", async () => {
		let cli = createCLI({ name: "sdxc", version: "2026.10.15", commands: CONTRACT });
		cli.map(CONTRACT.init, () => success());

		let version = await invoke(cli, ["--version"]);
		let nested = await invoke(cli, ["init", "--version"]);

		expect(version.stdout).toBe("2026.10.15\n");
		expect(nested.code).toBe(2);
	});

	test("styles headings and names when colour is forced", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });

		let run = await invoke(cli, ["--help"], { env: { FORCE_COLOR: "1" } });

		expect(run.stdout).toContain("\u001B[1mUsage:\u001B[22m");
		expect(run.stdout).toContain("\u001B[36minit\u001B[39m");
	});
});

describe("running", () => {
	test("runs a mapped handler, lazily imported, and exits 0", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });
		let imported = 0;
		cli.map(
			CONTRACT.init,
			lazy(async () => {
				imported += 1;
				return {
					default: createCommand(CONTRACT.init, (ctx) => {
						ctx.stdout(ctx.flags.dryRun ? "Would write\n" : "Wrote\n");
						return success();
					}),
				};
			}),
		);

		let help = await invoke(cli, ["init", "--help"]);
		expect(imported).toBe(0);
		let first = await invoke(cli, ["init", "--dry-run"]);
		let second = await invoke(cli, ["init"]);

		expect(help.code).toBe(0);
		expect(first).toMatchObject({ code: 0, stdout: "Would write\n" });
		expect(second.stdout).toBe("Wrote\n");
		expect(imported).toBe(1);
	});

	test("maps each outcome to its exit code", async () => {
		let contract = commands({
			ok: command(),
			fail: command(),
			use: command(),
			code: command(),
			quiet: command(),
			thrown: command(),
			unmapped: command(),
		});
		let cli = createCLI({ name: "p", commands: contract });
		cli.map(contract.ok, () => success());
		cli.map(contract.fail, () => failure(new Error("It broke")));
		cli.map(contract.use, () => usage("--from is required with --prompt"));
		cli.map(contract.code, () => exit(3, "Three"));
		cli.map(contract.quiet, () => exit(1));
		cli.map(contract.thrown, () => {
			throw new Error("A bug");
		});

		expect(await invoke(cli, ["ok"])).toMatchObject({ code: 0, stderr: "" });
		expect(await invoke(cli, ["fail"])).toMatchObject({ code: 1, stderr: "It broke\n" });
		let used = await invoke(cli, ["use"]);
		expect(used.code).toBe(2);
		expect(used.stderr).toMatch(/^--from is required with --prompt\n\nUsage: p use/);
		expect(await invoke(cli, ["code"])).toMatchObject({ code: 3, stderr: "Three\n" });
		expect(await invoke(cli, ["quiet"])).toMatchObject({ code: 1, stderr: "" });
		expect(await invoke(cli, ["thrown"])).toMatchObject({ code: 1, stderr: "A bug\n" });
		expect(await invoke(cli, ["unmapped"])).toMatchObject({
			code: 1,
			stderr: "p unmapped has no handler\n",
		});
	});

	test("prints an ExecError child's stderr under its exit summary", async () => {
		let { ExecError } = await import("./exec.js");
		let contract = commands({ child: command() });
		let cli = createCLI({ name: "p", commands: contract });
		cli.map(contract.child, () =>
			failure(
				new ExecError("bunx wrangler d1 migrations list db --remote exited with 1", {
					command: ["bunx", "wrangler"],
					code: 1,
					stderr: "Authentication error [code: 10000]\n",
				}),
			),
		);

		let run = await invoke(cli, ["child"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("exited with 1");
		expect(run.stderr).toContain("Authentication error [code: 10000]");
	});

	test("runs a mapped group when no member is named", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });
		cli.map(CONTRACT.ui, (ctx) => {
			ctx.stdout(`group ${ctx.path.join(" ")}\n`);
			return success();
		});

		expect(await invoke(cli, ["ui"])).toMatchObject({ code: 0, stdout: "group ui\n" });
	});

	test("runs a mapped group with the arguments and flags it declares", async () => {
		let contract = commands({
			make: commands({
				arguments: {
					kind: argument(s.enum_(["job", "model"]), {
						prompt: prompt.select({ message: "What?", options: ["job", "model"] }),
					}),
				},
				flags: { dryRun: flag.boolean("dry-run") },
				job: command({ flags: { dryRun: flag.boolean("dry-run") } }),
			}),
		});
		let cli = createCLI({ name: "sdxc", commands: contract });
		cli.map(contract.make, (ctx) => {
			expectTypeOf(ctx.arguments.kind).toEqualTypeOf<"job" | "model">();
			expectTypeOf(ctx.flags.dryRun).toEqualTypeOf<boolean>();
			ctx.stdout(`group ${ctx.arguments.kind} ${ctx.flags.dryRun}\n`);
			return success();
		});
		cli.map(contract.make.job, (ctx) => {
			ctx.stdout(`job ${ctx.flags.dryRun}\n`);
			return success();
		});

		let asked = await invoke(cli, ["make", "--dry-run"], { answers: { kind: "model" } });
		let typed = await invoke(cli, ["make", "model"]);
		let member = await invoke(cli, ["make", "--dry-run", "job"]);
		let quiet = await invoke(cli, ["make"], { interactive: false });
		let wrong = await invoke(cli, ["make", "jobb"]);

		expect(asked.stdout).toBe("group model true\n");
		expect(typed.stdout).toBe("group model false\n");
		expect(member.stdout).toBe("job true\n");
		expect(quiet.code).toBe(2);
		expect(quiet.stderr).toMatch(/^<kind> is required when stdin is not a terminal\n/);
		expect(wrong.code).toBe(2);
		expect(wrong.stderr).toMatch(/^Unknown command "jobb" for sdxc make; did you mean "job"\?\n/);
	});

	test("refuses mapping a command twice or one outside the contract", () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });
		cli.map(CONTRACT.init, () => success());

		expect(() => cli.map(CONTRACT.init, () => success())).toThrow("sdxc init is mapped twice");
		expect(() => cli.map(command(), () => success())).toThrow("outside sdxc");
	});
});

/** A context key one middleware publishes beside {@link COUNT}, typed as a string. */
const LOCALE = createContextKey<string>();

/** A context key one middleware publishes beside {@link LOCALE}, typed as a number. */
const COUNT = createContextKey<number>();

/** A middleware chain several commands share, so one helper types against it. */
const CHAIN = [project()] as const;

describe("middleware", () => {
	test("publishes onto the context for the CLI's handlers, typed from the chain", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [project()] });
		cli.map(CONTRACT.init, (ctx) => {
			expectTypeOf(ctx.project).toEqualTypeOf<string>();
			ctx.stdout(`${ctx.project} ${ctx.get(Project)} ${ctx.has(Project)}\n`);
			return success();
		});

		let run = await invoke(cli, ["init"], { cwd: "/work" });
		let failed = await invoke(cli, ["init"], { env: { NO_PROJECT: "1" } });

		expect(run.stdout).toBe("/work/root /work/root true\n");
		expect(failed).toMatchObject({ code: 1, stderr: "No project found\n" });
	});

	test("runs a command's own middleware after the CLI's", async () => {
		let order: string[] = [];
		let mark =
			(name: string): CommandMiddleware =>
			async (_ctx, next) => {
				order.push(name);
				await next();
			};
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [mark("cli")] });
		cli.map(
			CONTRACT.init,
			createCommand(CONTRACT.init, {
				middleware: [project(), mark("command")],
				handler: (ctx) => {
					expectTypeOf(ctx.project).toEqualTypeOf<string>();
					order.push("handler");
					return success();
				},
			}),
		);

		await invoke(cli, ["init"]);

		expect(order).toEqual(["cli", "command", "handler"]);
	});

	test("types every property a middleware declares as a union of effects", async () => {
		let both: CommandMiddleware<
			| { key: typeof LOCALE; value: string; property: "locale" }
			| { key: typeof COUNT; value: number; property: "count" }
		> = async (ctx, next) => {
			ctx.set(LOCALE, "es", { property: "locale" });
			ctx.set(COUNT, 2, { property: "count" });
			await next();
		};
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [both, project()] });
		cli.map(CONTRACT.init, (ctx) => {
			expectTypeOf(ctx.locale).toEqualTypeOf<string>();
			expectTypeOf(ctx.count).toEqualTypeOf<number>();
			expectTypeOf(ctx.project).toEqualTypeOf<string>();
			ctx.stdout(`${ctx.locale} ${ctx.count}\n`);
			return success();
		});

		expect((await invoke(cli, ["init"])).stdout).toBe("es 2\n");
	});

	test("types a helper shared by commands behind one chain", async () => {
		/** Reads what every command behind `CHAIN` receives. */
		let where = (ctx: ChainContext<typeof CHAIN>) => `${ctx.project} ${ctx.path.join(" ")}\n`;
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });
		cli.map(
			CONTRACT.init,
			createCommand(CONTRACT.init, {
				middleware: CHAIN,
				handler: (ctx) => success(ctx.stdout(where(ctx))),
			}),
		);
		cli.map(
			CONTRACT.ui.add,
			createCommand(CONTRACT.ui.add, {
				middleware: CHAIN,
				handler: (ctx) => success(ctx.stdout(where(ctx))),
			}),
		);

		let init = await invoke(cli, ["init"], { cwd: "/w" });
		let add = await invoke(cli, ["ui", "add", "button", "--no-git"], { cwd: "/w" });

		expect(init.stdout).toBe("/w/root init\n");
		expect(add.stdout).toBe("/w/root ui add\n");
	});

	test("ends the run without the handler when a middleware skips next()", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [() => undefined] });
		cli.map(CONTRACT.init, () => failure(new Error("unreachable")));

		expect((await invoke(cli, ["init"])).code).toBe(0);
	});

	test("hands each middleware what the rest of the chain answered", async () => {
		let seen: string[] = [];
		let observe: CommandMiddleware = async (_ctx, next) => {
			let result = await next();
			seen.push(isFailure(result) ? `exit ${exitCodeOf(result.error)}` : "ok");
		};
		let contract = commands({ ok: command(), bad: command(), denied: command() });
		let cli = createCLI({ name: "p", commands: contract, middleware: [observe] });
		cli.map(contract.ok, () => success());
		cli.map(contract.bad, () => usage("No"));
		cli.map(
			contract.denied,
			createCommand(contract.denied, {
				middleware: [() => failure(new Error("Denied"))],
				handler: () => success(),
			}),
		);

		await invoke(cli, ["ok"]);
		let bad = await invoke(cli, ["bad"]);
		let denied = await invoke(cli, ["denied"]);

		expect(seen).toEqual(["ok", "exit 2", "exit 1"]);
		expect(bad.code).toBe(2);
		expect(denied).toMatchObject({ code: 1, stderr: "Denied\n" });
	});

	test("reads what an earlier middleware published, or fails naming the command", async () => {
		let read: CommandMiddleware = async (ctx, next) => {
			ctx.stdout(`${ctx.require(Project)}\n`);
			await next();
		};
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [project(), read] });
		let bare = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [read] });
		cli.map(CONTRACT.init, () => success());
		bare.map(CONTRACT.init, () => success());

		expect((await invoke(cli, ["init"], { cwd: "/w" })).stdout).toBe("/w/root\n");
		expect(await invoke(bare, ["init"])).toMatchObject({
			code: 1,
			stderr: "init read a context key that no middleware published\n",
		});
	});

	test("adds variables to every child, under the call's own env", async () => {
		let requests: ExecRequest[] = [];
		let carry: CommandMiddleware = async (ctx, next) => {
			ctx.setExecEnv({ TRACEPARENT: "from-middleware", DROPPED: undefined });
			await next();
		};
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [carry] });
		cli.map(CONTRACT.init, async (ctx) => {
			await ctx.exec(["child"]);
			await ctx.exec(["child"], { env: { TRACEPARENT: "from-caller" } });
			return success();
		});

		await invoke(cli, ["init"], {
			env: { DROPPED: "inherited", HOME: "/home" },
			exec: async (_command, request) => {
				requests.push(request);
				return success({ code: 0, stdout: "", stderr: "", output: "" });
			},
		});

		expect(requests.map((request) => request.env)).toEqual([
			{ TRACEPARENT: "from-middleware", DROPPED: undefined, HOME: "/home" },
			{ TRACEPARENT: "from-caller", DROPPED: undefined, HOME: "/home" },
		]);
	});
});

describe("stdin", () => {
	test("reads what was piped in, and reports a terminal", async () => {
		let contract = commands({ run: command() });
		let cli = createCLI({ name: "p", commands: contract });
		cli.map(contract.run, async (ctx) => {
			if (ctx.stdin.isTTY) ctx.stdout("terminal\n");
			else ctx.stdout(`piped ${JSON.stringify(await ctx.stdin.text())}\n`);
			return success();
		});

		let piped = await invoke(cli, ["run"], { stdin: "SELECT 1;\n" });
		let terminal = await invoke(cli, ["run"]);

		expect(piped.stdout).toBe('piped "SELECT 1;\\n"\n');
		expect(terminal.stdout).toBe("terminal\n");
	});
});

describe("argument.rest", () => {
	/** A program whose `run` hands every token after its name to another program. */
	let program = commands({
		run: command({
			description: "Run the app's own command line",
			arguments: { args: argument.rest() },
		}),
	});

	/** The CLI under test, printing the tokens `run` received. */
	function forwarding() {
		let cli = createCLI({ name: "prog", commands: program });
		cli.map(program.run, (ctx) => {
			expectTypeOf(ctx.arguments.args).toEqualTypeOf<string[]>();
			ctx.stdout(`${JSON.stringify(ctx.arguments.args)}\n`);
			return success();
		});
		return cli;
	}

	test("receives flags and --help after the command's name unparsed", async () => {
		let run = await invoke(forwarding(), ["run", "users", "find", "--limit", "5", "-x", "--help"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe('["users","find","--limit","5","-x","--help"]\n');
	});

	test("receives nothing when nothing follows the command's name", async () => {
		let run = await invoke(forwarding(), ["run"]);

		expect(run.stdout).toBe("[]\n");
	});

	test("leaves --help before the command's name to the program", async () => {
		let run = await invoke(forwarding(), ["--help"]);

		expect(run.stdout).toContain("run  Run the app's own command line");
	});

	test("refuses a rest argument beside flags or another argument", () => {
		let withFlag = commands({
			run: command({
				arguments: { args: argument.rest() },
				flags: { quiet: flag.boolean("quiet") },
			}),
		});
		let withArgument = commands({
			run: command({ arguments: { name: argument(s.string()), args: argument.rest() } }),
		});

		expect(() => createCLI({ name: "prog", commands: withFlag })).toThrow(
			"argument.rest() is a command's only argument, with no flags",
		);
		expect(() => createCLI({ name: "prog", commands: withArgument })).toThrow(
			"argument.rest() is a command's only argument, with no flags",
		);
	});
});

describe("ctx.argv", () => {
	test("holds the arguments the run was given, before parsing", async () => {
		let program = commands({
			greet: command({
				arguments: { name: argument(s.string()) },
				flags: { shout: flag.boolean("shout") },
			}),
		});
		let cli = createCLI({ name: "prog", commands: program });
		cli.map(program.greet, (ctx) => {
			ctx.stdout(`${JSON.stringify(ctx.argv)}\n`);
			return success();
		});

		let run = await invoke(cli, ["greet", "--shout", "Ada"]);

		expect(run.stdout).toBe('["greet","--shout","Ada"]\n');
	});
});

describe("types", () => {
	test("types arguments and flags from the contract", () => {
		createCommand(CONTRACT.ui.add, (ctx) => {
			expectTypeOf(ctx.arguments.components).toEqualTypeOf<[string, ...string[]]>();
			expectTypeOf(ctx.flags.withDeps).toEqualTypeOf<boolean>();
			expectTypeOf(ctx.flags.template).toEqualTypeOf<string>();
			expectTypeOf(ctx.flags.allowNet).toEqualTypeOf<string[] | true>();
			return success();
		});
		let optional = command({
			arguments: { dir: argument(s.string(), { optional: true }) },
			flags: {
				output: flag.string("output"),
				count: flag.number("count", { required: true }),
				level: flag.string("level", { schema: s.enum_(["a", "b"]) }),
				tags: flag.string("tag").multiple(),
				net: flag.string("net").optionalValue(),
			},
		});
		createCommand(optional, (ctx) => {
			expectTypeOf(ctx.arguments.dir).toEqualTypeOf<string | undefined>();
			expectTypeOf(ctx.flags.output).toEqualTypeOf<string | undefined>();
			expectTypeOf(ctx.flags.count).toEqualTypeOf<number>();
			expectTypeOf(ctx.flags.level).toEqualTypeOf<"a" | "b" | undefined>();
			expectTypeOf(ctx.flags.tags).toEqualTypeOf<string[]>();
			expectTypeOf(ctx.flags.net).toEqualTypeOf<string | true | undefined>();
			return success();
		});
	});
});
