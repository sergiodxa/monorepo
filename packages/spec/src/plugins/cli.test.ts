/**
 * Tests for the built-in `cli` plugin: real child processes spawned in a
 * temp-directory workspace, permission gating through a stubbed grant set,
 * and the filtered environment children receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { PermissionSet } from "../permissions.js";
import type { ToolContext } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";
import type { Workspace } from "../workspace.js";

import { PermissionDeniedError } from "../errors.js";

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
	test("exposes a single run action requiring the run permission", () => {
		expect(plugin.namespace).toBe("cli");
		let descriptors = plugin.describe();
		expect(descriptors).toHaveLength(1);
		let descriptor = descriptors[0];
		expect(descriptor?.name).toBe("run");
		expect(descriptor?.kind).toBe("action");
		expect(descriptor?.requires).toBe("run");
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

interface StubGrants {
	/** `"all"` admits any executable; a list admits those basenames only. */
	run?: "all" | string[];
	/** Variable names `grantedEnvNames` reports. */
	envNames?: string[];
}

function makeContext(grants: StubGrants = { run: "all" }): ToolContext {
	return {
		workspace: createWorkspaceStub(root),
		permissions: createPermissionsStub(grants),
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	};
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
	return {
		checkRun(executable: string) {
			if (grants.run === "all") return success(undefined);
			if (Array.isArray(grants.run) && grants.run.includes(executable)) {
				return success(undefined);
			}
			return failure(
				new PermissionDeniedError("run", executable, `spec run --allow-run=${executable}`),
			);
		},
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => grants.envNames ?? [],
	};
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
