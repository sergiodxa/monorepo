/**
 * Tests for child processes and styling: the real spawn with each stdio mode, exit codes,
 * a program that cannot start, cancellation, the harness's recorded table, and when colour is
 * on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ExecRequest } from "./exec.js";

import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { CancelledError } from "./errors.js";
import { ExecError, spawnExec } from "./exec.js";
import { colorEnabled, createStyle, stripStyle } from "./style.js";
import { invoke } from "./test.js";

/** A request for `spawnExec` writing to captured streams. */
function request(overrides: Partial<ExecRequest> = {}) {
	let written = { stdout: "", stderr: "" };
	let base: ExecRequest = {
		cwd: process.cwd(),
		env: { ...process.env },
		stdio: "collect",
		signal: new AbortController().signal,
		input: undefined,
		stdout: { write: (text: string) => (written.stdout += text) },
		stderr: { write: (text: string) => (written.stderr += text) },
		...overrides,
	};
	return { base, written };
}

/** A command running a short script with the interpreter running the tests. */
function script(source: string): string[] {
	return [process.execPath, "-e", source];
}

describe("spawnExec", () => {
	test("collects output and answers exit 0", async () => {
		let { base } = request();

		let result = await spawnExec(
			script("process.stdout.write('out'); process.stderr.write('err')"),
			base,
		);

		expect(isSuccess(result) && result.data).toMatchObject({
			code: 0,
			stdout: "out",
			stderr: "err",
		});
	});

	test("forwards stdout to the CLI's stderr with stdio stderr", async () => {
		let { base, written } = request({ stdio: "stderr" });

		await spawnExec(script("process.stdout.write('installing')"), base);

		expect(written).toEqual({ stdout: "", stderr: "installing" });
	});

	test("passes input to the child's stdin", async () => {
		let { base } = request({ input: "piped" });

		let result = await spawnExec(
			script("process.stdin.on('data', (d) => process.stdout.write(String(d).toUpperCase()))"),
			base,
		);

		expect(isSuccess(result) && result.data.stdout).toBe("PIPED");
	});

	test("fails with the exit code and output of a child that exits non-zero", async () => {
		let { base } = request();

		let result = await spawnExec(script("process.stdout.write('partial'); process.exit(3)"), base);

		expect(isFailure(result) && result.error).toBeInstanceOf(ExecError);
		expect(isFailure(result) && result.error).toMatchObject({ code: 3, stdout: "partial" });
	});

	test("fails with no code for a program that cannot start", async () => {
		let { base } = request();

		let result = await spawnExec(["sdxc-cli-test-missing-program"], base);

		expect(isFailure(result) && result.error).toMatchObject({ code: null });
		expect(isFailure(result) && result.error.message).toContain("could not start");
	});

	test("stops the child and answers cancelled when the signal aborts", async () => {
		let controller = new AbortController();
		let { base } = request({ signal: controller.signal });

		let pending = spawnExec(script("setTimeout(() => {}, 10000)"), base);
		setTimeout(() => controller.abort(), 50);
		let result = await pending;

		expect(isFailure(result) && result.error).toBeInstanceOf(CancelledError);
	});
});

describe("ctx.exec under invoke", () => {
	test("records every command and fails one with no reply", async () => {
		let contract = commands({ go: command() });
		let cli = createCLI({ name: "app", commands: contract });
		cli.map(contract.go, async (ctx) => {
			let status = await ctx.exec(["git", "status", "--short"], { stdio: "collect", cwd: "/repo" });
			if (isSuccess(status)) ctx.stdout(status.data.stdout);
			return ctx.exec(["git", "commit", "-m", "first commit"]);
		});

		let run = await invoke(cli, ["go"], {
			exec: { "git status --short": { stdout: " M a.ts\n" } },
		});

		expect(run.stdout).toBe(" M a.ts\n");
		expect(run.code).toBe(1);
		expect(run.stderr).toBe('invoke() has no reply for git commit -m "first commit"\n');
		expect(run.exec.map((call) => call.command.join(" "))).toEqual([
			"git status --short",
			"git commit -m first commit",
		]);
		expect(run.exec[0]?.cwd).toBe("/repo");
	});
});

describe("style", () => {
	test("follows the terminal, NO_COLOR, TERM=dumb and FORCE_COLOR", () => {
		expect(colorEnabled({ isTTY: true }, {})).toBe(true);
		expect(colorEnabled({ isTTY: false }, {})).toBe(false);
		expect(colorEnabled({ isTTY: true }, { NO_COLOR: "1" })).toBe(false);
		expect(colorEnabled({ isTTY: true }, { TERM: "dumb" })).toBe(false);
		expect(colorEnabled({ isTTY: false }, { FORCE_COLOR: "1" })).toBe(true);
		expect(colorEnabled({ isTTY: true }, { FORCE_COLOR: "0" })).toBe(false);
	});

	test("keeps the outer style after a nested one closes", () => {
		let style = createStyle(true);

		let text = style.red(`a ${style.green("b")} c`);

		expect(text).toBe("\u001B[31ma \u001B[32mb\u001B[39m\u001B[31m c\u001B[39m");
		expect(stripStyle(text)).toBe("a b c");
		expect(createStyle(false).bold("plain")).toBe("plain");
	});
});
