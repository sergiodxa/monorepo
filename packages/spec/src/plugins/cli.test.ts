/**
 * Tests for the built-in `cli` plugin: real child processes spawned in a
 * temp-directory workspace, permission gating through a stubbed grant set,
 * the filtered environment children receive, and the lifetime of started ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

import type { Result } from "@sdxc/result";

import { isFailure, isSuccess, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { PermissionSet } from "../permissions.js";
import type { Plugin, ToolContext } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";
import type { Workspace } from "../workspace.js";

import { PermissionDeniedError } from "../errors.js";
import { createPermissionSet } from "../permissions.js";
import { createToolContext } from "../tool-context.js";

import { createCliPlugin } from "./cli.js";

/** The env var the leak tests plant on the host side. */
const SECRET_NAME = "SPEC_CLI_TEST_SECRET";

/** A one-liner the child runs to reveal whether the secret reached it. */
const PRINT_SECRET = `console.log(JSON.stringify(process.env.${SECRET_NAME} ?? null))`;

let plugin = createCliPlugin();
let root: string;

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "spec-cli-plugin-")));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
	delete process.env[SECRET_NAME];
});

describe("createCliPlugin", () => {
	test("launching a program needs the run permission, and output is an observable", () => {
		expect(plugin.namespace).toBe("cli");
		let byName = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		expect([...byName.keys()]).toEqual(["run", "start", "output", "stop"]);
		expect(byName.get("run")?.requires).toBe("run");
		expect(byName.get("start")?.requires).toBe("run");
		expect(byName.get("output")?.kind).toBe("observable");
		expect(byName.get("stop")?.kind).toBe("action");
	});

	test("fails on a tool it does not expose", async () => {
		let error = expectFailure(await plugin.call("exec", [value("echo")], makeContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('cli has no tool named "exec"');
	});
});

describe("run", () => {
	test("captures stdout, stderr, and the exit code", async () => {
		let result = await plugin.call("run", [value("echo"), value("hello")], makeContext());
		expect(expectSuccess(result)).toEqual({ stdout: "hello\n", stderr: "", exit_code: 0 });
	});

	test("reports a nonzero exit code and stderr", async () => {
		let script = 'console.error("boom"); process.exit(3)';
		let result = await plugin.call(
			"run",
			[value("bun"), value("-e"), value(script)],
			makeContext(),
		);
		expect(expectSuccess(result)).toEqual({ stdout: "", stderr: "boom\n", exit_code: 3 });
	});

	test("runs the child in the workspace root", async () => {
		let script = "console.log(process.cwd())";
		let result = await plugin.call(
			"run",
			[value("bun"), value("-e"), value(script)],
			makeContext(),
		);
		expect(expectSuccess(result)).toEqual({ stdout: `${root}\n`, stderr: "", exit_code: 0 });
	});

	test("does not leak host environment variables without a grant", async () => {
		process.env[SECRET_NAME] = "s3cret";
		let result = await plugin.call(
			"run",
			[value("bun"), value("-e"), value(PRINT_SECRET)],
			makeContext(),
		);
		expect(expectSuccess(result)).toEqual({ stdout: "null\n", stderr: "", exit_code: 0 });
	});

	test("forwards exactly the granted environment variables", async () => {
		process.env[SECRET_NAME] = "s3cret";
		let context = makeContext({ run: "all", envNames: [SECRET_NAME] });
		let result = await plugin.call(
			"run",
			[value("bun"), value("-e"), value(PRINT_SECRET)],
			context,
		);
		expect(expectSuccess(result)).toEqual({ stdout: '"s3cret"\n', stderr: "", exit_code: 0 });
	});

	test("propagates the permission denial without spawning", async () => {
		let context = makeContext({ run: [] });
		let error = expectFailure(await plugin.call("run", [value("echo"), value("x")], context));
		expect(error.code).toBe("permission-denied");
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.remedy).toBe("spec run --allow-run=echo");
	});

	test("checks the permission against the executable's basename", async () => {
		let context = makeContext({ run: ["echo"] });
		let result = await plugin.call("run", [value("/bin/echo"), value("hi")], context);
		expect(expectSuccess(result)).toEqual({ stdout: "hi\n", stderr: "", exit_code: 0 });
	});

	test("rejects a non-string argument", async () => {
		let error = expectFailure(await plugin.call("run", [value("echo"), value(42)], makeContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("cli.run arguments must all be strings; argument 2 is 42");
	});

	test("rejects a bare-word argument", async () => {
		let error = expectFailure(
			await plugin.call("run", [value("echo"), word("loudly")], makeContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('argument 2 is the bare word "loudly"');
	});

	test("demands an executable", async () => {
		let error = expectFailure(await plugin.call("run", [], makeContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("expects an executable");
	});

	test("reports a missing executable as a tool error", async () => {
		let error = expectFailure(
			await plugin.call("run", [value("spec-test-no-such-binary-xyz")], makeContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('cli.run failed to start "spec-test-no-such-binary-xyz"');
	});
});

describe("in", () => {
	test("runs the program in the directory it names", async () => {
		let elsewhere = await realpath(await mkdtemp(join(tmpdir(), "spec-cli-in-")));
		try {
			let result = await plugin.call(
				"run",
				[value("pwd"), word("in"), value(elsewhere)],
				makeContext(),
			);
			expect(expectSuccess(result)).toMatchObject({ stdout: `${elsewhere}\n`, exit_code: 0 });
		} finally {
			await rm(elsewhere, { recursive: true, force: true });
		}
	});

	test("needs the host filesystem grant for that directory", async () => {
		let error = expectFailure(
			await plugin.call(
				"run",
				[value("pwd"), word("in"), value(tmpdir())],
				makeContext({ run: "all", hostFs: false }),
			),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.message).toContain("host-fs");
	});

	test("comes last, followed by the directory", async () => {
		let error = expectFailure(
			await plugin.call("run", [value("pwd"), word("in"), value(root), value("x")], makeContext()),
		);
		expect(error.message).toContain("`in` last");
	});
});

describe("start, output and stop", () => {
	test("start returns while the program runs, and output reads what it printed", async () => {
		let started = createCliPlugin();
		let context = makeContext();
		try {
			let handle = expectSuccess(
				await started.call(
					"start",
					[value("sh"), value("-c"), value("echo up; sleep 30")],
					context,
				),
			);
			await waitForOutput(started, handle, "up");
			expect(
				expectSuccess(
					await started.call("output", [value(handle), word("contains"), value("up")], context),
				),
			).toBe(true);
		} finally {
			await started.dispose?.();
		}
	});

	test("output names a program that exited without printing what was expected", async () => {
		let started = createCliPlugin();
		let context = makeContext();
		let handle = expectSuccess(
			await started.call("start", [value("sh"), value("-c"), value("echo nope; exit 4")], context),
		);
		let message = "";
		let deadline = Date.now() + 2000;
		while (!message.includes("exited") && Date.now() < deadline) {
			let read = await started.call(
				"output",
				[value(handle), word("contains"), value("ready")],
				context,
			);
			message = isFailure(read) ? read.error.message : "";
			await new Promise((settle) => setTimeout(settle, 20));
		}
		expect(message).toContain("exited with code 4");

		let stopped = expectSuccess(await started.call("stop", [value(handle)], context));
		expect(stopped).toEqual({ exit_code: 4, output: "nope\n" });
	});

	/**
	 * `bun run dev` is a script that spawns the real server, so stopping only the
	 * script would leave the server holding its port.
	 */
	test("stop takes down the processes the program spawned", async () => {
		let started = createCliPlugin();
		let context = makeContext();
		let handle = expectSuccess(
			await started.call(
				"start",
				[value("sh"), value("-c"), value("sleep 30 & echo $!; wait")],
				context,
			),
		);
		let grandchild = Number((await waitForOutput(started, handle, "\n")).trim());
		expectSuccess(await started.call("stop", [value(handle)], context));
		expect(isAlive(grandchild)).toBe(false);
	});

	test("disposing the plugin stops every program still running", async () => {
		let started = createCliPlugin();
		let handle = expectSuccess(
			await started.call("start", [value("sleep"), value("30")], makeContext()),
		);
		let pid = (handle as { pid: number }).pid;
		expect(isAlive(pid)).toBe(true);
		await started.dispose?.();
		expect(isAlive(pid)).toBe(false);
	});

	test("output and stop refuse anything but a handle start returned", async () => {
		let error = expectFailure(await plugin.call("stop", [value({ id: "99" })], makeContext()));
		expect(error.message).toContain("the handle cli.start returned");
	});
});

/** Poll a started program's output until it includes `text`, failing after two seconds. */
async function waitForOutput(started: Plugin, handle: Value, text: string): Promise<string> {
	let deadline = Date.now() + 2000;
	while (Date.now() < deadline) {
		let read = await started.call("output", [value(handle)], makeContext());
		if (isSuccess(read) && typeof read.data === "string" && read.data.includes(text))
			return read.data;
		await new Promise((settle) => setTimeout(settle, 20));
	}
	throw new Error(`the program never printed ${JSON.stringify(text)}`);
}

/** Whether a process with this id still exists. */
function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

interface StubGrants {
	/** `"all"` admits any executable; a list admits those basenames only. */
	run?: "all" | string[];
	/** Whether the host filesystem is reachable; it is unless this is `false`. */
	hostFs?: boolean;
	/** Variable names `grantedEnvNames` reports. */
	envNames?: string[];
}

function makeContext(grants: StubGrants = { run: "all" }): ToolContext {
	return createToolContext({
		workspace: createWorkspaceStub(root),
		permissions: createPermissionsStub(grants),
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	});
}

/** A workspace stub over a real temp directory; cli only reads its root. */
function createWorkspaceStub(base: string): Workspace {
	return {
		root: base,
		resolve(input: string) {
			return success(resolvePath(base, input));
		},
		async cleanup(): Promise<undefined> {
			await rm(base, { recursive: true, force: true });
			return undefined;
		},
	};
}

function createPermissionsStub(grants: StubGrants): PermissionSet {
	return createPermissionSet({
		run: grants.run === "all" ? { mode: "all" } : { mode: "scoped", scopes: grants.run ?? [] },
		net: { mode: "all" },
		env: { mode: "scoped", scopes: [...(grants.envNames ?? [])] },
		hostFs: grants.hostFs === false ? { mode: "denied" } : { mode: "all" },
		db: { mode: "all" },
	});
}

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** Narrow to the success data or fail the test with the error's message. */
function expectSuccess<T, E extends Error>(result: Result<T, E>): T {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

/** Narrow to the failure error or fail the test with the unexpected data. */
function expectFailure<T, E extends Error>(result: Result<T, E>): E {
	if (isSuccess(result)) throw new Error(`Expected failure, got: ${JSON.stringify(result.data)}`);
	return result.error;
}
