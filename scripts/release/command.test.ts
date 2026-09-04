/**
 * The process boundary under a real child: a clean exit yields both streams, a non-zero exit
 * and a missing executable yield a `CommandError` carrying the code and the output, and stderr
 * streams to the caller as it arrives. Node itself is the child, so every machine has it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CommandOptions } from "./command.js";

import { CommandError, run } from "./command.js";

/** Runs the current Node binary with an inline script, from the repo root. */
function node(script: string, options: Pick<CommandOptions, "onStderr"> = {}) {
	return run(process.execPath, ["-e", script], { cwd: process.cwd(), ...options });
}

describe("run", () => {
	test("answers both streams of a command that exits zero", async () => {
		expect(await unwrap(node("console.log('ok')"))).toEqual({ stdout: "ok\n", stderr: "" });
	});

	test("answers a CommandError carrying the exit status and stderr of a failing command", async () => {
		let result = await node("console.error('bad'); process.exitCode = 3");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(CommandError);
		expect(result.error.code).toBe(3);
		expect(result.error.stderr).toBe("bad\n");
		expect(result.error.stdout).toBe("");
		expect(result.error.message).toContain("exited with 3: bad");
	});

	test("answers ENOENT for an executable that does not exist", async () => {
		let result = await run("sdxc-release-no-such-command", ["--version"], { cwd: process.cwd() });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(CommandError);
		expect(result.error.code).toBe("ENOENT");
		expect(result.error.message).toBe(
			"`sdxc-release-no-such-command --version` failed with ENOENT",
		);
	});

	test("streams stderr to onStderr as it arrives", async () => {
		let chunks: string[] = [];
		let result = await node("console.error('one'); console.error('two')", {
			onStderr: (chunk) => {
				chunks.push(chunk);
			},
		});

		expect(isSuccess(result)).toBe(true);
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks.join("")).toBe("one\ntwo\n");
	});
});
