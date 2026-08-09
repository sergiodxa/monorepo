/**
 * Tests for the NDJSON stdio transport: the describe handshake and its
 * caching, call round-trips against the real demo plugin, wire error
 * reconstruction, environment stripping, and child lifecycle on failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { isFailure, isSuccess, success } from "@pkg/result";

import type { ToolContext } from "./plugin";
import type { Value } from "./values";

import { SpecError } from "./errors";
import { connectStdioPlugin } from "./transport-stdio";

/** The demo plugin's path, resolved from this file's directory. */
const DEMO_PLUGIN_PATH = path.join(import.meta.dir, "plugins", "demo.ts");

/**
 * A raw NDJSON plugin written against the wire protocol directly (no
 * servePlugin), so tests control every reply byte. The called tool's name
 * selects the behavior: echo the workspace root, dump the environment, reply
 * garbage, exit silently, or fail with the tool's name as the wire code.
 */
const RAW_PLUGIN_SCRIPT = `
let buffer = "";
process.stdin.on("data", (chunk) => {
	buffer += chunk;
	let index = buffer.indexOf("\\n");
	while (index !== -1) {
		const line = buffer.slice(0, index);
		buffer = buffer.slice(index + 1);
		index = buffer.indexOf("\\n");
		const request = JSON.parse(line);
		if (request.method === "describe") {
			process.stdout.write(JSON.stringify({ id: request.id, result: [] }) + "\\n");
			continue;
		}
		if (request.tool === "workspace") {
			process.stdout.write(JSON.stringify({ id: request.id, result: request.workspaceRoot }) + "\\n");
		} else if (request.tool === "env") {
			process.stdout.write(JSON.stringify({ id: request.id, result: Object.keys(process.env) }) + "\\n");
		} else if (request.tool === "malformed") {
			process.stdout.write("this is not json\\n");
		} else if (request.tool === "die") {
			process.exit(0);
		} else {
			process.stdout.write(JSON.stringify({ id: request.id, error: { code: request.tool, message: "wire failure for " + request.tool } }) + "\\n");
		}
	}
});
`;

/** A child that reports its pid, then stays alive without ever replying. */
const SILENT_PLUGIN_SCRIPT = `
await Bun.write(process.argv[1], String(process.pid));
setTimeout(() => {}, 60000);
`;

/** A child that exits immediately, before replying to anything. */
const EXITING_PLUGIN_SCRIPT = `process.exit(0);`;

/** A minimal context whose workspace root the transport should forward. */
function stubContext(root: string): ToolContext {
	return {
		workspace: {
			root,
			resolve(target) {
				return success(target);
			},
			async cleanup() {
				return undefined;
			},
		},
		permissions: {
			checkRun() {
				return success(undefined);
			},
			checkNet() {
				return success(undefined);
			},
			checkEnv() {
				return success(undefined);
			},
			checkHostFs() {
				return success(undefined);
			},
			grantedEnvNames() {
				return [];
			},
		},
	};
}

/** Poll a predicate until it holds or the timeout elapses. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
	let deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await Bun.sleep(25);
	}
	return predicate();
}

/** Whether a process with this pid still exists (signal 0 probe). */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

describe("connectStdioPlugin", () => {
	test("connects to the demo plugin and caches its descriptors", async () => {
		let connected = await connectStdioPlugin([process.execPath, DEMO_PLUGIN_PATH], "demo");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		expect(plugin.namespace).toBe("demo");
		let first = plugin.describe();
		expect(first.map((descriptor) => descriptor.name)).toEqual(["say", "upper"]);
		expect(first[0]?.kind).toBe("action");
		expect(first[1]?.kind).toBe("observable");
		// Cached: the same array comes back without another round-trip.
		expect(plugin.describe()).toBe(first);
	});

	test("round-trips calls over the pipe", async () => {
		let connected = await connectStdioPlugin([process.execPath, DEMO_PLUGIN_PATH], "demo");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		let context = stubContext("/tmp/spec-transport-root");

		let echoed = await plugin.call("say", [{ kind: "value", value: "ping" }], context);
		expect(isSuccess(echoed)).toBe(true);
		if (isSuccess(echoed)) expect(echoed.data).toBe("ping");

		let structured: Value = { user: { name: "Ada" }, tags: ["a", "b"] };
		let echoedObject = await plugin.call("say", [{ kind: "value", value: structured }], context);
		expect(isSuccess(echoedObject)).toBe(true);
		if (isSuccess(echoedObject)) expect(echoedObject.data).toEqual(structured);

		let uppercased = await plugin.call("upper", [{ kind: "value", value: "hello" }], context);
		expect(isSuccess(uppercased)).toBe(true);
		if (isSuccess(uppercased)) expect(uppercased.data).toBe("HELLO");
	});

	test("serves concurrent calls in request order", async () => {
		let connected = await connectStdioPlugin([process.execPath, DEMO_PLUGIN_PATH], "demo");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		let context = stubContext("/tmp/spec-transport-root");
		let [first, second] = await Promise.all([
			plugin.call("say", [{ kind: "value", value: "one" }], context),
			plugin.call("upper", [{ kind: "value", value: "two" }], context),
		]);
		expect(isSuccess(first)).toBe(true);
		if (isSuccess(first)) expect(first.data).toBe("one");
		expect(isSuccess(second)).toBe(true);
		if (isSuccess(second)) expect(second.data).toBe("TWO");
	});

	test("maps a plugin tool failure back to a SpecError", async () => {
		let connected = await connectStdioPlugin([process.execPath, DEMO_PLUGIN_PATH], "demo");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		let result = await plugin.call(
			"upper",
			[{ kind: "value", value: 42 }],
			stubContext("/tmp/spec-transport-root"),
		);
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(SpecError);
		expect(result.error.code).toBe("tool-error");
		expect(result.error.message).toContain("expects a string");
	});

	test("preserves a known wire error code and maps unknown codes to tool-error", async () => {
		let connected = await connectStdioPlugin([process.execPath, "-e", RAW_PLUGIN_SCRIPT], "raw");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		let context = stubContext("/tmp/spec-transport-root");

		let known = await plugin.call("expectation-failed", [], context);
		expect(isFailure(known)).toBe(true);
		if (isFailure(known)) {
			expect(known.error.code).toBe("expectation-failed");
			expect(known.error.message).toBe("wire failure for expectation-failed");
		}

		let unknown = await plugin.call("not-a-real-code", [], context);
		expect(isFailure(unknown)).toBe(true);
		if (isFailure(unknown)) {
			expect(unknown.error.code).toBe("tool-error");
			expect(unknown.error.message).toBe("wire failure for not-a-real-code");
		}
	});

	test("forwards the caller's workspace root over the wire", async () => {
		let connected = await connectStdioPlugin([process.execPath, "-e", RAW_PLUGIN_SCRIPT], "raw");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let result = await connected.data.call(
			"workspace",
			[],
			stubContext("/tmp/spec-forwarded-root"),
		);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("/tmp/spec-forwarded-root");
	});

	test("gives the child no environment beyond PATH", async () => {
		process.env.SPEC_TRANSPORT_SENTINEL = "must-not-leak";
		try {
			let connected = await connectStdioPlugin([process.execPath, "-e", RAW_PLUGIN_SCRIPT], "raw");
			expect(isSuccess(connected)).toBe(true);
			if (!isSuccess(connected)) return;
			let result = await connected.data.call("env", [], stubContext("/tmp/spec-transport-root"));
			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) return;
			let names = result.data as string[];
			expect(names).toContain("PATH");
			expect(names).not.toContain("SPEC_TRANSPORT_SENTINEL");
			expect(names).not.toContain("HOME");
		} finally {
			delete process.env.SPEC_TRANSPORT_SENTINEL;
		}
	});

	test("fails the handshake when the child exits without replying", async () => {
		let connected = await connectStdioPlugin(
			[process.execPath, "-e", EXITING_PLUGIN_SCRIPT],
			"exiting",
		);
		expect(isFailure(connected)).toBe(true);
		if (isFailure(connected)) {
			expect(connected.error.code).toBe("tool-error");
			expect(connected.error.message).toContain("closed the connection");
		}
	});

	test("times out the handshake and kills a silent child", async () => {
		let directory = await fs.mkdtemp(path.join(os.tmpdir(), "spec-transport-"));
		let pidfile = path.join(directory, "pid");
		try {
			let connected = await connectStdioPlugin(
				[process.execPath, "-e", SILENT_PLUGIN_SCRIPT, pidfile],
				"silent",
			);
			expect(isFailure(connected)).toBe(true);
			if (isFailure(connected)) {
				expect(connected.error.code).toBe("tool-error");
				expect(connected.error.message).toContain('did not reply to "describe" within 5000ms');
			}
			let pid = Number(await fs.readFile(pidfile, "utf8"));
			expect(Number.isInteger(pid)).toBe(true);
			expect(await waitFor(() => !isProcessAlive(pid), 2000)).toBe(true);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	}, 10_000);

	test("rejects a pending call when the plugin exits mid-call", async () => {
		let connected = await connectStdioPlugin([process.execPath, "-e", RAW_PLUGIN_SCRIPT], "raw");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		let context = stubContext("/tmp/spec-transport-root");
		let dying = await plugin.call("die", [], context);
		expect(isFailure(dying)).toBe(true);
		if (isFailure(dying)) {
			expect(dying.error.code).toBe("tool-error");
			expect(dying.error.message).toContain("closed the connection");
		}
		// The connection is closed; later calls fail fast instead of hanging.
		let afterwards = await plugin.call("workspace", [], context);
		expect(isFailure(afterwards)).toBe(true);
		if (isFailure(afterwards)) {
			expect(afterwards.error.message).toContain("no longer running");
		}
	});

	test("fails a call when the plugin replies with a malformed line", async () => {
		let connected = await connectStdioPlugin([process.execPath, "-e", RAW_PLUGIN_SCRIPT], "raw");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let result = await connected.data.call(
			"malformed",
			[],
			stubContext("/tmp/spec-transport-root"),
		);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("tool-error");
			expect(result.error.message).toContain("wire protocol");
		}
	});

	test("fails to connect when the executable does not exist", async () => {
		let connected = await connectStdioPlugin(["definitely-not-a-real-binary-xyz"], "ghost");
		expect(isFailure(connected)).toBe(true);
		if (isFailure(connected)) {
			expect(connected.error.code).toBe("tool-error");
			expect(connected.error.message).toContain("Failed to spawn");
		}
	});

	test("fails to connect on an empty command", async () => {
		let connected = await connectStdioPlugin([], "empty");
		expect(isFailure(connected)).toBe(true);
		if (isFailure(connected)) {
			expect(connected.error.code).toBe("tool-error");
			expect(connected.error.message).toContain("command is empty");
		}
	});
});
