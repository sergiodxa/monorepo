/**
 * Tests for tasks: the Result each answers, the plain two-line output without a terminal,
 * counted and nested tasks, cancellation, and the animated frame sharing the terminal with
 * writes and child processes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CommandContext } from "./context.js";
import type { CommandResult } from "./middleware.js";

import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { success as done } from "./errors.js";
import { invoke } from "./test.js";

/** A CLI whose one command runs `handler`. */
function program(handler: (ctx: CommandContext) => Promise<CommandResult>) {
	let contract = commands({ go: command() });
	let cli = createCLI({ name: "app", commands: contract });
	cli.map(contract.go, handler);
	return cli;
}

describe("without a terminal", () => {
	test("prints the label once and the final line once, with the count", async () => {
		let cli = program(async (ctx) => {
			let copied = await ctx.task("Copying components", async (task) => {
				task.total(2);
				task.update("Copying button");
				task.advance();
				task.advance(5);
				task.update("Copying components");
				return 2;
			});
			ctx.stdout(`${isSuccess(copied) ? copied.data : "none"}\n`);
			return done();
		});

		let run = await invoke(cli, ["go"]);

		expect(run.stdout).toBe("2\n");
		expect(run.stderr).toBe("Copying components\n✓ Copying components 2/2\n");
	});

	test("indents nested tasks and prints nothing for an unlabelled one", async () => {
		let cli = program(async (ctx) => {
			await ctx.task("Creating", async () => {
				await ctx.task("Downloading", () => "zip");
				await ctx.task(() => "quiet");
				await ctx.task("Installing", () => undefined);
			});
			return done();
		});

		let run = await invoke(cli, ["go"]);

		expect(run.stderr).toBe(
			[
				"Creating",
				"  Downloading",
				"  ✓ Downloading",
				"  Installing",
				"  ✓ Installing",
				"✓ Creating",
				"",
			].join("\n"),
		);
	});

	test("answers a thrown error and a returned failure, printing the message once", async () => {
		let cli = program(async (ctx) => {
			let thrown = await ctx.task("Parsing", () => JSON.parse("{"));
			let returned = await ctx.task(() => failure(new Error("No posts")));
			let passed = await ctx.task(() => success(3));
			ctx.stdout(
				`${isFailure(thrown)} ${isFailure(returned)} ${isSuccess(passed) && passed.data}\n`,
			);
			return returned;
		});

		let run = await invoke(cli, ["go"]);

		expect(run.code).toBe(1);
		expect(run.stdout).toBe("true true 3\n");
		expect(run.stderr).toBe("Parsing\n✗ Parsing\nNo posts\n");
	});

	test("aborts task.signal on cancellation and exits 130", async () => {
		let controller = new AbortController();
		let cli = program(async (ctx) =>
			ctx.task(
				"Waiting",
				(task) =>
					new Promise((_, reject) => {
						task.signal.addEventListener("abort", () => reject(new Error("aborted")));
						controller.abort();
					}),
			),
		);

		let run = await invoke(cli, ["go"], { signal: controller.signal });

		expect(run.code).toBe(130);
		expect(run.stderr).toBe("Waiting\n✗ Waiting\n");
	});
});

describe("on a terminal", () => {
	test("leaves the final lines with times once the frame is gone", async () => {
		let cli = program(async (ctx) => {
			await ctx.task("Creating", async () => {
				await ctx.task("Downloading", (task) => {
					task.total(3);
					task.advance(3);
				});
			});
			await ctx.task(() => "gone");
			return done();
		});

		let run = await invoke(cli, ["go"], { tty: { columns: 60 } });

		expect(run.stderr).toMatch(/^✓ Creating \(\d+ ms\)\n {2}✓ Downloading 3\/3 \(\d+ ms\)$/);
	});

	test("writes above a running task and redraws it", async () => {
		let cli = program(async (ctx) => {
			await ctx.task("Working", async () => {
				ctx.stderr("first\n");
				ctx.stdout("to stdout\n");
				ctx.stderr("second\n");
			});
			return done();
		});

		let run = await invoke(cli, ["go"], { tty: { columns: 60 } });

		expect(run.stdout).toBe("to stdout\n");
		expect(run.stderr).toMatch(/^first\nsecond\n✓ Working \(\d+ ms\)$/);
	});

	test("pauses the spinner while a child prints to the terminal", async () => {
		let cli = program(async (ctx) => {
			let installed = await ctx.task("Installing", () =>
				ctx.exec(["npm", "install"], { stdio: "stderr" }),
			);
			return installed;
		});

		let run = await invoke(cli, ["go"], {
			tty: { columns: 60 },
			exec: { "npm install": { stdout: "added 3 packages\n" } },
		});

		expect(run.code).toBe(0);
		expect(run.exec).toEqual([
			{ command: ["npm", "install"], cwd: process.cwd(), stdio: "stderr" },
		]);
		expect(run.stderr).toMatch(/^added 3 packages\n✓ Installing \(\d+ ms\)$/);
	});

	test("prints plain lines with --no-progress, in CI and on a dumb terminal", async () => {
		let cli = program(async (ctx) => {
			await ctx.task("Working", () => undefined);
			return done();
		});

		let flagged = await invoke(cli, ["go", "--no-progress"], { tty: {} });
		let ci = await invoke(cli, ["go"], { tty: {}, env: { CI: "true" } });
		let dumb = await invoke(cli, ["go"], { tty: {}, env: { TERM: "dumb" } });

		expect(flagged.stderr).toBe("Working\n✓ Working");
		expect(ci.stderr).toBe("Working\n✓ Working");
		expect(dumb.stderr).toBe("Working\n✓ Working");
	});
});
