/**
 * Tests for the contract and parsing: every flag kind and modifier, `--no-<name>`, `--`,
 * short and long aliases, scoped flags, suggestions, and one usage error holding every problem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { CommandResult } from "./middleware.js";

import { argument } from "./argument.js";
import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { success } from "./errors.js";
import { flag } from "./flag.js";
import { invoke } from "./test.js";

/** A contract exercising every kind of input. */
const CONTRACT = commands({
	description: "A test program",
	run: command({
		description: "Run things",
		arguments: { directory: argument(s.string(), { optional: true }) },
		flags: {
			force: flag.boolean("force", { short: "f", description: "Overwrite" }),
			install: flag.boolean("install", { default: true }),
			output: flag.string("output", { short: "o", valueName: "file" }),
			retries: flag.number("retries", { default: 0 }),
			concurrency: flag.number("concurrency", { aliases: ["jobs"], default: 1 }),
			tag: flag.string("tag").multiple(),
			allowEnv: flag.string("allow-env").optionalValue().list(),
			allowNet: flag.string("allow-net").optionalValue(),
			seed: flag.string("seed"),
			mode: flag.string("mode", { schema: s.enum_(["fast", "slow"]) }),
		},
	}),
	ui: commands({
		description: "Components",
		add: command({
			arguments: { components: argument.variadic(s.string(), { min: 1 }) },
			flags: { withDeps: flag.boolean("with-deps") },
		}),
		update: command({
			arguments: { components: argument.variadic(s.string()) },
			flags: { force: flag.boolean("force") },
		}),
		remove: command({ flags: { force: flag.boolean("force") } }),
	}),
});

/** Runs `argv` and answers the exit code, the output, and what the handler read. */
async function parse(argv: string[]) {
	let seen: { arguments: unknown; flags: unknown } | undefined;
	let cli = createCLI({ name: "prog", commands: CONTRACT });
	let record = (ctx: { arguments: unknown; flags: unknown }): CommandResult => {
		seen = { arguments: ctx.arguments, flags: ctx.flags };
		return success();
	};
	cli.map(CONTRACT.run, record);
	cli.map(CONTRACT.ui.add, record);
	cli.map(CONTRACT.ui.update, record);
	cli.map(CONTRACT.ui.remove, record);
	let run = await invoke(cli, argv);
	return { ...run, seen };
}

describe("flags", () => {
	test("reads defaults when nothing is passed", async () => {
		let run = await parse(["run"]);

		expect(run.code).toBe(0);
		expect(run.seen).toEqual({
			arguments: { directory: undefined },
			flags: {
				force: false,
				install: true,
				output: undefined,
				retries: 0,
				concurrency: 1,
				tag: [],
				allowEnv: [],
				allowNet: undefined,
				seed: undefined,
				mode: undefined,
			},
		});
	});

	test("reads a boolean, its negation and its short alias", async () => {
		expect((await parse(["run", "--force"])).seen?.flags).toMatchObject({ force: true });
		expect((await parse(["run", "-f"])).seen?.flags).toMatchObject({ force: true });
		expect((await parse(["run", "--no-install"])).seen?.flags).toMatchObject({ install: false });
	});

	test("rejects a boolean passed with its negation, and one given a value", async () => {
		let both = await parse(["run", "--force", "--no-force"]);
		let valued = await parse(["run", "--force=yes"]);

		expect(both.code).toBe(2);
		expect(both.stderr).toContain("--force and --no-force cannot be passed together");
		expect(valued.stderr).toContain("--force takes no value");
	});

	test("reads a string as --name value, --name=value and -s value", async () => {
		expect((await parse(["run", "--output", "a.txt"])).seen?.flags).toMatchObject({
			output: "a.txt",
		});
		expect((await parse(["run", "--output=a.txt"])).seen?.flags).toMatchObject({ output: "a.txt" });
		expect((await parse(["run", "-o", "a.txt"])).seen?.flags).toMatchObject({ output: "a.txt" });
	});

	test("keeps the last value of a repeated single flag", async () => {
		let run = await parse(["run", "--seed=a", "--seed=b"]);

		expect(run.seen?.flags).toMatchObject({ seed: "b" });
	});

	test("reads a number and a long alias, and rejects text that is not a number", async () => {
		expect((await parse(["run", "--retries", "3"])).seen?.flags).toMatchObject({ retries: 3 });
		expect((await parse(["run", "--jobs=8"])).seen?.flags).toMatchObject({ concurrency: 8 });
		let bad = await parse(["run", "--retries=many"]);
		expect(bad.code).toBe(2);
		expect(bad.stderr).toContain('--retries: expects a number, got "many"');
	});

	test("collects a repeated flag", async () => {
		let run = await parse(["run", "--tag", "a", "--tag=b"]);

		expect(run.seen?.flags).toMatchObject({ tag: ["a", "b"] });
	});

	test("reads an optional value bare, scoped, and as a comma list", async () => {
		expect((await parse(["run", "--allow-net"])).seen?.flags).toMatchObject({ allowNet: true });
		expect((await parse(["run", "--allow-net=api.example.com"])).seen?.flags).toMatchObject({
			allowNet: "api.example.com",
		});
		expect(
			(await parse(["run", "--allow-env=HOME, PATH", "--allow-env=USER"])).seen?.flags,
		).toMatchObject({
			allowEnv: ["HOME", "PATH", "USER"],
		});
		expect((await parse(["run", "--allow-env=HOME", "--allow-env"])).seen?.flags).toMatchObject({
			allowEnv: true,
		});
	});

	test("leaves the next token alone after a bare optional-value flag", async () => {
		let run = await parse(["run", "--allow-net", "dir"]);

		expect(run.seen).toMatchObject({ arguments: { directory: "dir" }, flags: { allowNet: true } });
	});

	test("rejects an empty comma list and a missing value", async () => {
		let empty = await parse(["run", "--allow-env="]);
		let missing = await parse(["run", "--output"]);

		expect(empty.stderr).toContain("--allow-env= needs at least one value");
		expect(missing.stderr).toContain("--output needs a value");
	});

	test("checks values through the flag's schema", async () => {
		expect((await parse(["run", "--mode=fast"])).seen?.flags).toMatchObject({ mode: "fast" });
		let bad = await parse(["run", "--mode=medium"]);
		expect(bad.code).toBe(2);
		expect(bad.stderr).toMatch(/^--mode: /);
	});

	test("reports every problem in one usage error", async () => {
		let run = await parse(["run", "--retries=x", "--mode=medium", "--nope", "a", "b"]);

		expect(run.code).toBe(2);
		let lines = run.stderr.split("\n\n")[0]?.split("\n");
		expect(lines).toHaveLength(4);
		expect(lines?.[0]).toBe("Unknown flag --nope");
		expect(run.stderr).toContain('Unexpected argument "b"');
		expect(run.stderr).toContain("Usage: prog run [directory] [options]");
	});
});

describe("arguments and commands", () => {
	test("reads everything after -- as positionals", async () => {
		let run = await parse(["ui", "add", "--", "--force", "-x"]);

		expect(run.seen?.arguments).toEqual({ components: ["--force", "-x"] });
	});

	test("enforces a variadic argument's minimum", async () => {
		let none = await parse(["ui", "add"]);
		let some = await parse(["ui", "add", "button", "dialog"]);

		expect(none.code).toBe(2);
		expect(none.stderr).toContain("Missing argument <components>");
		expect(some.seen?.arguments).toEqual({ components: ["button", "dialog"] });
	});

	test("names the commands that take a flag passed to another one", async () => {
		let run = await parse(["ui", "add", "button", "--force"]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain(
			"--force is not a flag of prog ui add; prog run, prog ui update and prog ui remove take it",
		);
	});

	test("suggests the closest command and flag", async () => {
		let command = await parse(["ui", "ad"]);
		let flagged = await parse(["run", "--forse"]);

		expect(command.stderr).toContain('Unknown command "ad" for prog ui; did you mean "add"?');
		expect(flagged.stderr).toContain("Unknown flag --forse; did you mean --force?");
	});

	test("prints a group's help on stderr with exit 2 when no member is named", async () => {
		let run = await parse(["ui"]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Usage: prog ui <command> [options]");
	});
});

describe("contract mistakes", () => {
	test("refuses reserved, duplicate and negated flag names, and a variadic argument before another", () => {
		let reserved = commands({ a: command({ flags: { help: flag.boolean("help") } }) });
		let duplicate = commands({
			a: command({ flags: { one: flag.boolean("x"), two: flag.string("x") } }),
		});
		let negated = commands({ a: command({ flags: { x: flag.boolean("no-x") } }) });
		let variadic = commands({
			a: command({
				arguments: { rest: argument.variadic(s.string()), last: argument(s.string()) },
			}),
		});

		expect(() => createCLI({ name: "p", commands: reserved })).toThrow("--help is reserved");
		expect(() => createCLI({ name: "p", commands: duplicate })).toThrow("two flags are named --x");
		expect(() => createCLI({ name: "p", commands: negated })).toThrow("--no-x is reserved");
		expect(() => createCLI({ name: "p", commands: variadic })).toThrow("must be the last one");
	});
});
