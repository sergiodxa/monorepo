/**
 * Tests for prompts: binding to flags and arguments, scripted answers by name and in order,
 * the rules without a terminal, handler-called prompts, and each kind driven key by key on a
 * virtual terminal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Command } from "./command.js";
import type { HandlerContext } from "./handler.js";
import type { PromptError } from "./prompt.js";

import { argument } from "./argument.js";
import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { success } from "./errors.js";
import { flag } from "./flag.js";
import { prompt } from "./prompt.js";
import { invoke } from "./test.js";

/** Rejects anything shorter than three characters. */
const NAME = s.string().refine((value) => value.length >= 3, "Use at least 3 characters");

/** The built-in templates, one of them unavailable. */
const TEMPLATES = [
	{ value: "app", hint: "a full app" },
	{ value: "minimal" },
	{ value: "legacy", disabled: true },
	{ value: "site" },
];

/** A `create` command whose every input asks when missing. */
const CONTRACT = commands({
	create: command({
		arguments: {
			directory: argument(NAME, {
				prompt: prompt.text({ message: "Where should the project go?", placeholder: "my-app" }),
			}),
		},
		flags: {
			template: flag.string("template", {
				default: "app",
				prompt: prompt.select({ message: "Which template?", options: TEMPLATES, ask: "always" }),
			}),
			git: flag.boolean("git", { prompt: prompt.confirm({ message: "Initialize git?" }) }),
		},
	}),
	ask: command(),
});

/** A CLI whose `create` prints what it received, and whose `ask` runs `handler`. */
function program(handler?: (ctx: HandlerContext<typeof CONTRACT.ask>) => Promise<string>) {
	let cli = createCLI({ name: "app", commands: CONTRACT });
	cli.map(CONTRACT.create, (ctx) => {
		ctx.stdout(`${JSON.stringify({ ...ctx.arguments, ...ctx.flags })}\n`);
		return success();
	});
	if (handler !== undefined) {
		cli.map(CONTRACT.ask, async (ctx) => {
			ctx.stdout(`${await handler(ctx)}\n`);
			return success();
		});
	}
	return cli;
}

/** A one-command CLI asking `prompted` for its `value` flag, for the per-kind terminal tests. */
function single(prompted: Command) {
	let contract = commands({ go: prompted });
	let cli = createCLI({ name: "app", commands: contract });
	cli.map(contract.go, (ctx) => {
		ctx.stdout(`${JSON.stringify(ctx.flags)}\n`);
		return success();
	});
	return cli;
}

describe("prompts bound to flags and arguments", () => {
	test("answers each by the input it fills and leaves a summary line", async () => {
		let run = await invoke(program(), ["create"], {
			answers: { directory: "my-app", template: "minimal", git: true },
		});

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({ directory: "my-app", template: "minimal", git: true });
		expect(run.stderr).toBe(
			[
				"✓ Where should the project go? my-app",
				"✓ Which template? minimal",
				"✓ Initialize git? Yes",
				"",
			].join("\n"),
		);
	});

	test("answers in the order the prompts are asked", async () => {
		let run = await invoke(program(), ["create"], { answers: ["my-app", "site", false] });

		expect(JSON.parse(run.stdout)).toEqual({ directory: "my-app", template: "site", git: false });
	});

	test("never asks for a value the command line gave", async () => {
		let run = await invoke(program(), ["create", "my-app", "--template=site", "--no-git"], {
			answers: {},
		});

		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
	});

	test("asks an always-ask prompt despite its default, and fails on one left unscripted", async () => {
		let run = await invoke(program(), ["create", "my-app", "--git"], { answers: {} });

		expect(run.code).toBe(1);
		expect(run.stderr).toBe('invoke() has no scripted answer for --template ("Which template?")\n');
	});

	test("fails a scripted answer its schema rejects", async () => {
		let run = await invoke(program(), ["create"], { answers: { directory: "x" } });

		expect(run.code).toBe(1);
		expect(run.stderr).toBe(
			"invoke()'s answer for <directory> was rejected: Use at least 3 characters\n",
		);
	});

	test("takes defaults without a terminal and names an input that has none", async () => {
		let missing = await invoke(program(), ["create"], { interactive: false });
		let given = await invoke(program(), ["create", "my-app"], { interactive: false });

		expect(missing.code).toBe(2);
		expect(missing.stderr).toMatch(/^<directory> is required when stdin is not a terminal\n\n/);
		expect(JSON.parse(given.stdout)).toEqual({ directory: "my-app", template: "app", git: false });
	});
});

/** A command whose `--git` stays unset unless passed or answered. */
const TRI_STATE = commands({
	go: command({
		flags: {
			git: flag.boolean("git", {
				default: undefined,
				prompt: prompt.confirm({ message: "Initialize git?" }),
			}),
			cache: flag.boolean("cache", { default: undefined }),
		},
	}),
});

describe("tri-state boolean flags", () => {
	test("read undefined when neither spelling is passed, and ask on a terminal", async () => {
		let cli = createCLI({ name: "app", commands: TRI_STATE });
		cli.map(TRI_STATE.go, (ctx) => {
			expectTypeOf(ctx.flags.git).toEqualTypeOf<boolean | undefined>();
			ctx.stdout(`${String(ctx.flags.git)} ${String(ctx.flags.cache)}\n`);
			return success();
		});

		let quiet = await invoke(cli, ["go"], { interactive: false });
		let asked = await invoke(cli, ["go"], { answers: { git: true } });
		let given = await invoke(cli, ["go", "--no-git", "--cache"], { answers: {} });

		expect(quiet.stdout).toBe("undefined undefined\n");
		expect(asked.stdout).toBe("true undefined\n");
		expect(given.stdout).toBe("false true\n");
	});
});

describe("prompts a handler asks", () => {
	test("start a terminal from `initial` and answer `default` without one", async () => {
		let cli = program(async (ctx) => {
			let git = await ctx.prompt.confirm({
				message: "Initialize git?",
				default: false,
				initial: true,
				name: "git",
			});
			return isFailure(git) ? "failed" : String(git.data);
		});

		let quiet = await invoke(cli, ["ask"], { interactive: false });
		let entered = await invoke(cli, ["ask"], { tty: {}, keys: ["x", "enter"] });

		expect(quiet.stdout).toBe("false\n");
		expect(entered.screens[0]).toBe("? Initialize git? (Y/n) › ● Yes / ○ No");
		expect(entered.stdout).toBe("true\n");
	});

	test("confirm: names its answers, in the toggle and the summary", async () => {
		let cli = program(async (ctx) => {
			let mode = await ctx.prompt.confirm({
				message: "Mode",
				active: "fast",
				inactive: "careful",
				default: false,
			});
			return isFailure(mode) ? "failed" : String(mode.data);
		});

		let run = await invoke(cli, ["ask"], { tty: {}, keys: ["x", "enter"] });

		expect(run.screens[0]).toBe("? Mode (y/N) › ○ fast / ● careful");
		expect(run.stderr).toBe("✓ Mode careful");
	});

	test("infer a list prompt's value type from its options", async () => {
		let cli = program(async (ctx) => {
			let names = ["a", "b"];
			let picked = await ctx.prompt.multiselect({ message: "Which?", options: names, default: [] });
			let one = await ctx.prompt.select({ message: "One?", options: names, default: "a" });
			expectTypeOf(picked).toEqualTypeOf<Result<string[], PromptError>>();
			expectTypeOf(one).toEqualTypeOf<Result<string, PromptError>>();
			return isFailure(picked) || isFailure(one) ? "failed" : `${picked.data.join()} ${one.data}`;
		});

		let run = await invoke(cli, ["ask"], { answers: [["b"], "b"] });

		expect(run.stdout).toBe("b b\n");
	});

	test("answer the default without a terminal, and from the script with one", async () => {
		let cli = program(async (ctx) => {
			let overwrite = await ctx.prompt.confirm({
				message: "Overwrite button.tsx?",
				default: false,
				name: "overwrite",
			});
			let token = await ctx.prompt.password({ message: "GitHub token", default: "" });
			if (isFailure(overwrite) || isFailure(token)) return "failed";
			return `${overwrite.data} ${token.data}`;
		});

		let quiet = await invoke(cli, ["ask"], { interactive: false });
		let named = await invoke(cli, ["ask"], { answers: { overwrite: true } });
		let ordered = await invoke(cli, ["ask"], { answers: [true, "secret"] });

		expect(quiet.stdout).toBe("false \n");
		expect(named.stdout).toBe("failed\n");
		expect(ordered.stdout).toBe("true secret\n");
		expect(ordered.stderr).toBe("✓ Overwrite button.tsx? Yes\n✓ GitHub token ••••••\n");
	});
});

describe("prompts on a terminal", () => {
	test("text: placeholder, editing, and a failed check kept under the prompt", async () => {
		let run = await invoke(program(), ["create", "--template=app", "--no-git"], {
			tty: { columns: 60 },
			keys: ["ab", "enter", "c", "left", "backspace", "x", "enter"],
		});

		expect(run.code).toBe(0);
		expect(run.screens[0]).toBe("? Where should the project go? › a");
		expect(run.screens[1]).toBe("? Where should the project go? › ab");
		expect(run.screens[2]).toBe("? Where should the project go? › ab\n  Use at least 3 characters");
		expect(JSON.parse(run.stdout)).toMatchObject({ directory: "axc" });
		expect(run.stderr).toBe("✓ Where should the project go? axc");
	});

	test("password: one dot per character", async () => {
		let cli = single(
			command({
				flags: {
					value: flag.string("token", { prompt: prompt.password({ message: "Token" }) }),
				},
			}),
		);

		let run = await invoke(cli, ["go"], { tty: {}, keys: ["abc", "enter"] });

		expect(run.screens[2]).toBe("? Token › •••");
		expect(JSON.parse(run.stdout)).toEqual({ value: "abc" });
		expect(run.stderr).toBe("✓ Token •••");
	});

	test("number: arrows step within the bounds and Enter checks them", async () => {
		let cli = single(
			command({
				flags: {
					value: flag.number("count", {
						default: 2,
						prompt: prompt.number({ message: "How many?", min: 1, max: 3, ask: "always" }),
					}),
				},
			}),
		);

		let run = await invoke(cli, ["go"], {
			tty: {},
			keys: ["up", "up", "backspace", "9", "enter", "backspace", "1", "enter"],
		});

		expect(run.screens[0]).toBe("? How many? › 3");
		expect(run.screens[1]).toBe("? How many? › 3");
		expect(run.screens[4]).toBe("? How many? › 9\n  Enter a number of at most 3");
		expect(JSON.parse(run.stdout)).toEqual({ value: 1 });
	});

	test("confirm: arrows switch and y answers at once", async () => {
		let run = await invoke(program(), ["create", "my-app", "--template=app"], {
			tty: {},
			keys: ["right", "y"],
		});

		expect(run.screens[0]).toBe("? Initialize git? (Y/n) › ● Yes / ○ No");
		expect(JSON.parse(run.stdout)).toMatchObject({ git: true });
		expect(run.stderr).toBe("✓ Initialize git? Yes");
	});

	test("select: the default preselected, disabled options skipped, typing jumps", async () => {
		let run = await invoke(program(), ["create", "my-app", "--no-git"], {
			tty: {},
			keys: ["down", "down", "m", "enter"],
		});

		expect(run.screens[0]).toBe(
			["? Which template?", "  app a full app", "❯ minimal", "  legacy (disabled)", "  site"].join(
				"\n",
			),
		);
		expect(run.screens[1]).toBe(
			["? Which template?", "  app a full app", "  minimal", "  legacy (disabled)", "❯ site"].join(
				"\n",
			),
		);
		expect(JSON.parse(run.stdout)).toMatchObject({ template: "minimal" });
	});

	test("multiselect: Space toggles, a toggles all, and Enter enforces the minimum", async () => {
		let cli = single(
			command({
				flags: {
					value: flag.string("component").multiple().list(),
				},
			}),
		);
		let contract = commands({
			go: command({
				flags: {
					value: flag
						.string("component", {
							prompt: prompt.multiselect({
								message: "Remove which?",
								options: ["button", "dialog", "menu"],
								min: 1,
							}),
						})
						.multiple(),
				},
			}),
		});
		let prompted = createCLI({ name: "app", commands: contract });
		prompted.map(contract.go, (ctx) => {
			ctx.stdout(`${JSON.stringify(ctx.flags.value)}\n`);
			return success();
		});

		let run = await invoke(prompted, ["go"], {
			tty: {},
			keys: ["enter", "a", "a", "down", "space", "enter"],
		});

		expect(run.screens[0]).toBe(
			["? Remove which?", "❯ ◯ button", "  ◯ dialog", "  ◯ menu", "  Select at least 1"].join("\n"),
		);
		expect(run.screens[1]).toBe(
			["? Remove which?", "❯ ◉ button", "  ◉ dialog", "  ◉ menu"].join("\n"),
		);
		expect(run.stdout).toBe('["dialog"]\n');
		expect(run.stderr).toBe("✓ Remove which? dialog");
		expect((await invoke(cli, ["go"])).stdout).toBe('{"value":[]}\n');
	});

	test("search: typing filters, and multiple answers every toggled option", async () => {
		let contract = commands({
			go: command({
				arguments: {
					components: argument.variadic(s.string(), {
						prompt: prompt.search({
							message: "Add which?",
							options: ["button", "dialog", "date-picker", "menu"],
							multiple: true,
						}),
					}),
				},
				flags: {
					one: flag.string("one", {
						prompt: prompt.search({ message: "Which one?", options: ["red", "green", "blue"] }),
					}),
				},
			}),
		});
		let cli = createCLI({ name: "app", commands: contract });
		cli.map(contract.go, (ctx) => {
			ctx.stdout(`${JSON.stringify([ctx.arguments.components, ctx.flags.one])}\n`);
			return success();
		});

		let run = await invoke(cli, ["go"], {
			tty: {},
			keys: ["d", "a", "space", "enter", "re", "down", "enter"],
		});

		expect(run.screens[1]).toBe(["? Add which? › da", "❯ ◯ date-picker"].join("\n"));
		expect(run.screens[0]).toBe(["? Add which? › d", "❯ ◯ dialog", "  ◯ date-picker"].join("\n"));
		expect(JSON.parse(run.stdout)).toEqual([["date-picker"], "green"]);
	});

	test("Escape cancels, exits 130 and leaves nothing on the screen", async () => {
		let run = await invoke(program(), ["create"], { tty: {}, keys: ["ab", "escape"] });

		expect(run.code).toBe(130);
		expect(run.stderr).toBe("");
		expect(run.stdout).toBe("");
	});
});
