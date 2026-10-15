/**
 * Tests for the runtime: generated help at every level, `--version`, mapping and lazy
 * handlers, middleware publishing onto the context, and the exit code of every outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { CommandMiddleware } from "./middleware.js";

import { argument } from "./argument.js";
import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { exit, success, usage } from "./errors.js";
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
				allowNet: flag.string("allow-net", { valueName: "host" }).optionalValue().list(),
			},
			examples: ["ui add button dialog"],
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
				"  --with-deps               Copy what they reach too",
				"  --template <name>         Template (default: app)",
				"  --[no-]git",
				"  --no-install              Install dependencies",
				"  --allow-net[=<host,...>]",
				"  --no-progress             Print tasks without animation",
				"  -h, --help                Show this help",
				"",
				"Examples:",
				"  sdxc ui add button dialog",
				"",
			].join("\n"),
		);
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

	test("runs a mapped group when no member is named", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });
		cli.map(CONTRACT.ui, (ctx) => {
			ctx.stdout(`group ${ctx.path.join(" ")}\n`);
			return success();
		});

		expect(await invoke(cli, ["ui"])).toMatchObject({ code: 0, stdout: "group ui\n" });
	});

	test("refuses mapping a command twice or one outside the contract", () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT });
		cli.map(CONTRACT.init, () => success());

		expect(() => cli.map(CONTRACT.init, () => success())).toThrow("sdxc init is mapped twice");
		expect(() => cli.map(command(), () => success())).toThrow("outside sdxc");
	});
});

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

	test("ends the run without the handler when a middleware skips next()", async () => {
		let cli = createCLI({ name: "sdxc", commands: CONTRACT, middleware: [() => undefined] });
		cli.map(CONTRACT.init, () => failure(new Error("unreachable")));

		expect((await invoke(cli, ["init"])).code).toBe(0);
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
