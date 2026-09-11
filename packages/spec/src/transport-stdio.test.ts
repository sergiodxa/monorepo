/**
 * Tests for the NDJSON stdio transport: the describe handshake and its
 * caching, call round-trips against the real demo plugin, the context a
 * served plugin rebuilds from the wire, wire error reconstruction,
 * environment stripping, and child lifecycle on failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { isFailure, isSuccess, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { describe, expect, test } from "vitest";

import type { Grants } from "./permissions.js";
import type { ToolContext } from "./plugin.js";
import type { Value } from "./values.js";

import { createBaseSet, createConnectionSet } from "./bases.js";
import { PermissionDeniedError, SpecError } from "./errors.js";
import { createPermissionSet } from "./permissions.js";
import { createToolContext } from "./tool-context.js";
import { connectStdioPlugin } from "./transport-stdio.js";

/** The demo plugin's path, resolved from this file's directory. */
const DEMO_PLUGIN_PATH = path.join(import.meta.dirname, "plugins", "demo.ts");

/** The transport's own path, which a served child imports to answer the wire. */
const TRANSPORT_PATH = path.join(import.meta.dirname, "transport-stdio.ts");

/** The grants of a run that allowed nothing, which each test widens. */
const NOTHING_GRANTED: Grants = {
	run: { mode: "denied" },
	net: { mode: "denied" },
	env: { mode: "denied" },
	hostFs: { mode: "denied" },
	db: { mode: "denied" },
};

/**
 * The Bun executable, found on PATH. Every child here is a Bun program, so it
 * is spawned by name rather than through `process.execPath`, which names
 * whichever runtime happens to be running this file.
 */
const BUN_EXECUTABLE = "bun";

/**
 * A raw NDJSON plugin written against the wire protocol directly (no
 * servePlugin), so tests control every reply byte. The called tool's name
 * selects the behavior: echo, dump env, reply garbage, exit, or fail.
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
			process.stdout.write(JSON.stringify({ id: request.id, result: request.context.workspaceRoot }) + "\\n");
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

/**
 * A plugin served through `servePlugin`, whose tools answer from the context
 * the serving side rebuilt: the run's nonce, a target resolved through the
 * bases, and a connection the `db` grant has to allow before it is named.
 */
const CONTEXT_PLUGIN_SCRIPT = `
const { servePlugin } = await import(process.argv[1]);
const { success } = await import("@sdxc/result");

await servePlugin({
	namespace: "context",
	describe() {
		return [
			{ name: "nonce", summary: "The run's nonce.", kind: "observable", params: [] },
			{ name: "target", summary: "A target resolved through the run's bases.", kind: "observable", params: [] },
			{ name: "reach", summary: "The URL of a connection the caller may reach.", kind: "observable", requires: "db", params: [] },
		];
	},
	async call(tool, args, context) {
		if (tool === "nonce") return success(context.run.nonce);
		if (tool === "target") {
			const resolved = context.bases.resolve("/orders");
			if (resolved.status === "failure") return resolved;
			return success(resolved.data.href);
		}
		const name = args[0].value;
		const allowed = context.permissions.checkDb(name);
		if (allowed.status === "failure") return allowed;
		const connection = context.connections.resolve(name);
		if (connection.status === "failure") return connection;
		return success(connection.data.url);
	},
});
`;

/** A child that reports its pid, then idles indefinitely, well past the handshake timeout. */
const SILENT_PLUGIN_SCRIPT = `
await Bun.write(process.argv[1], String(process.pid));
setTimeout(() => {}, 60000);
`;

/** A child that exits before the handshake completes. */
const EXITING_PLUGIN_SCRIPT = `process.exit(0);`;

/**
 * A caller's context whose parts the transport should forward.
 *
 * @param root - The workspace root the child must see.
 * @param overrides - The rest of the context this call is about.
 */
function stubContext(root: string, overrides: Partial<ToolContext> = {}): ToolContext {
	return createToolContext({
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
		workspace: {
			root,
			resolve(target) {
				return success(target);
			},
			async cleanup() {
				return undefined;
			},
		},
		...overrides,
	});
}

/** Poll a predicate until it holds or the timeout elapses. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
	let deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await sleep(25);
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
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, DEMO_PLUGIN_PATH], "demo");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let plugin = connected.data;
		expect(plugin.namespace).toBe("demo");
		let first = plugin.describe();
		expect(first.map((descriptor) => descriptor.name)).toEqual(["say", "upper"]);
		expect(first[0]?.kind).toBe("action");
		expect(first[1]?.kind).toBe("observable");
		expect(plugin.describe()).toBe(first);
	});

	test("round-trips calls over the pipe", async () => {
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, DEMO_PLUGIN_PATH], "demo");
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
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, DEMO_PLUGIN_PATH], "demo");
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
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, DEMO_PLUGIN_PATH], "demo");
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
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, "-e", RAW_PLUGIN_SCRIPT], "raw");
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
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, "-e", RAW_PLUGIN_SCRIPT], "raw");
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

	test("gives a served plugin the run identity and the run's bases", async () => {
		let connected = await connectStdioPlugin(
			[BUN_EXECUTABLE, "-e", CONTEXT_PLUGIN_SCRIPT, TRANSPORT_PATH],
			"context",
		);
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let context = stubContext("/tmp/spec-transport-root", {
			run: { id: "run-7", attempt: 2, nonce: "run-7-2" },
			bases: createBaseSet([{ name: "web", url: "https://example.test/api" }]),
		});

		let nonce = await connected.data.call("nonce", [], context);
		expect(isSuccess(nonce)).toBe(true);
		if (isSuccess(nonce)) expect(nonce.data).toBe("run-7-2");

		let target = await connected.data.call("target", [], context);
		expect(isSuccess(target)).toBe(true);
		if (isSuccess(target)) expect(target.data).toBe("https://example.test/api/orders");
	});

	test("gates a served plugin's db tool on the caller's connection grants", async () => {
		let connected = await connectStdioPlugin(
			[BUN_EXECUTABLE, "-e", CONTEXT_PLUGIN_SCRIPT, TRANSPORT_PATH],
			"context",
		);
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) return;
		let context = stubContext("/tmp/spec-transport-root", {
			connections: createConnectionSet([
				{ name: "main", url: "postgres://localhost/main" },
				{ name: "analytics", url: "postgres://localhost/analytics" },
			]),
			permissions: createPermissionSet({
				...NOTHING_GRANTED,
				db: { mode: "scoped", scopes: ["main"] },
			}),
		});

		let granted = await connected.data.call("reach", [{ kind: "value", value: "main" }], context);
		expect(isSuccess(granted)).toBe(true);
		if (isSuccess(granted)) expect(granted.data).toBe("postgres://localhost/main");

		let denied = await connected.data.call(
			"reach",
			[{ kind: "value", value: "analytics" }],
			context,
		);
		expect(isFailure(denied)).toBe(true);
		if (isFailure(denied)) {
			expect(denied.error.code).toBe("permission-denied");
			expect(denied.error.message).toContain("analytics");
			/**
			 * A denial the reporter cannot print the flag for is a denial nobody can
			 * act on, so the structured fields cross the wire with the message and the
			 * error comes back as the class the reporter groups.
			 */
			expect(denied.error).toBeInstanceOf(PermissionDeniedError);
			expect(denied.error.remedy).toBe("spec run --allow-db=analytics");
			let denial = denied.error as PermissionDeniedError;
			expect(denial.permission).toBe("db");
			expect(denial.resource).toBe("analytics");
		}
	});

	test("gives the child no environment beyond PATH", async () => {
		process.env.SPEC_TRANSPORT_SENTINEL = "must-not-leak";
		try {
			let connected = await connectStdioPlugin([BUN_EXECUTABLE, "-e", RAW_PLUGIN_SCRIPT], "raw");
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
			[BUN_EXECUTABLE, "-e", EXITING_PLUGIN_SCRIPT],
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
				[BUN_EXECUTABLE, "-e", SILENT_PLUGIN_SCRIPT, pidfile],
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
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, "-e", RAW_PLUGIN_SCRIPT], "raw");
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
		let afterwards = await plugin.call("workspace", [], context);
		expect(isFailure(afterwards)).toBe(true);
		if (isFailure(afterwards)) {
			expect(afterwards.error.message).toContain("no longer running");
		}
	});

	test("fails a call when the plugin replies with a malformed line", async () => {
		let connected = await connectStdioPlugin([BUN_EXECUTABLE, "-e", RAW_PLUGIN_SCRIPT], "raw");
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
