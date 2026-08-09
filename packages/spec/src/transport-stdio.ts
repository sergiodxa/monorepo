/**
 * The NDJSON-over-stdio plugin transport: how an external executable becomes
 * a `Plugin`. This module is the protocol's reference documentation.
 *
 * Wire protocol: one JSON document per line over the child process's stdio.
 * Host→plugin requests are `{"id":1,"method":"describe"}` and
 * `{"id":2,"method":"call","tool":"say","args":[…ToolArg…],"workspaceRoot":"/abs/path"}`.
 * Plugin→host replies are `{"id":n,"result":…}` or
 * `{"id":n,"error":{"code":DiagnosticCode,"message":string}}`. Request ids
 * are strictly increasing, and the plugin must reply in the order it received
 * the requests. The child inherits NO environment beyond PATH.
 *
 * Honesty note: v1 external plugins receive `workspaceRoot` and perform their
 * own filesystem work — central *scoped* enforcement over the wire is an open
 * question tracked in the design suite; the runtime's coarse `requires` gate
 * still applies host-side before any call crosses the wire.
 *
 * A connected plugin exposes `dispose()`, which the runner calls after a run:
 * it kills the child process and fails anything still in flight, so a launched
 * plugin never outlives the suite that launched it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import path from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, isSuccess, success } from "@pkg/result";

import type { DiagnosticCode } from "./errors";
import type { PermissionSet } from "./permissions";
import type { Plugin, ToolContext, ToolDescriptor } from "./plugin";
import type { ToolArg, Value } from "./values";
import type { Workspace } from "./workspace";

import { PermissionDeniedError, SpecError, ToolError, WorkspaceEscapeError } from "./errors";

/** How long `connectStdioPlugin` waits for the describe reply. */
const HANDSHAKE_TIMEOUT_MS = 5000;

/** Every code a plugin may put on the wire; anything else maps to tool-error. */
const WIRE_CODES: ReadonlySet<string> = new Set<DiagnosticCode>([
	"parse-error",
	"load-error",
	"duplicate-definition",
	"unknown-name",
	"ambiguous-name",
	"expectation-failed",
	"permission-denied",
	"tool-error",
	"workspace-escape",
	"usage-error",
]);

/** The slice of a spawned child the transport needs, kept structural. */
interface PluginProcess {
	/** The pipe the host writes requests into. */
	stdin: { write(chunk: string): unknown; flush(): unknown };
	/** The pipe the plugin writes replies into. */
	stdout: ReadableStream<Uint8Array>;
	/** Terminate the child process. */
	kill(): void;
}

/** The body of a host→plugin request, before an id is assigned. */
interface WireRequestBody {
	/** Which operation the host wants: `describe` or `call`. */
	method: "describe" | "call";
	/** The tool name, for `call` requests. */
	tool?: string;
	/** The evaluated arguments, for `call` requests. */
	args?: ToolArg[];
	/** The absolute workspace root, for `call` requests. */
	workspaceRoot?: string;
}

/** A parsed host→plugin request as the serving side sees it. */
interface WireRequest {
	/** The request id the reply must echo. */
	id: number;
	/** The requested method as written on the wire. */
	method: string;
	/** The tool name, when present. */
	tool?: string;
	/** The call arguments, when present. */
	args?: ToolArg[];
	/** The workspace root, when present. */
	workspaceRoot?: string;
}

/** A plugin→host reply: a result or a coded error, never both. */
type WireReply =
	| { id: number; result: unknown }
	| { id: number; error: { code: string; message: string } };

/** One in-flight request awaiting its reply. */
interface PendingReply {
	/** Deliver the reply (or the failure that stands in for it) exactly once. */
	settle(outcome: Result<unknown, SpecError>): void;
}

/** The host side of one child's wire: sequenced requests over the pipes. */
interface Connection {
	/** Send one request and await its matching reply. */
	request(body: WireRequestBody, timeoutMs?: number): Promise<Result<unknown, SpecError>>;
	/** Kill the child and fail everything still in flight. */
	kill(): void;
}

/**
 * Spawn an external plugin process and connect it as a `Plugin`. Sends the
 * describe handshake (5s timeout), caches the returned descriptors, and
 * returns a plugin whose `call()` round-trips over the child's stdio. The
 * child receives no environment beyond PATH; on any handshake failure the
 * child is killed before the error is returned.
 *
 * @param command - The argv to spawn, e.g. `["bun", "plugins/demo.ts"]`.
 * @param namespace - The namespace the connected plugin's tools live under.
 * @returns The connected plugin, or the failure that prevented the handshake.
 */
export async function connectStdioPlugin(
	command: string[],
	namespace: string,
): Promise<Result<Plugin, SpecError>> {
	if (command.length === 0) {
		return failure(new ToolError("Cannot connect a stdio plugin: the command is empty"));
	}
	let child: PluginProcess;
	try {
		child = Bun.spawn({
			cmd: command,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "ignore",
			env: { PATH: process.env.PATH ?? "" },
		});
	} catch (error) {
		return failure(
			new ToolError(
				`Failed to spawn plugin command "${command.join(" ")}": ${errorMessage(error)}`,
			),
		);
	}
	let connection = openConnection(child);
	let handshake = await connection.request({ method: "describe" }, HANDSHAKE_TIMEOUT_MS);
	if (isFailure(handshake)) {
		connection.kill();
		return handshake;
	}
	if (!Array.isArray(handshake.data)) {
		connection.kill();
		return failure(
			new ToolError(
				`Plugin "${command.join(" ")}" answered the describe handshake with ${JSON.stringify(handshake.data)} instead of a tool descriptor list`,
			),
		);
	}
	let descriptors = handshake.data as ToolDescriptor[];
	return success({
		namespace,
		describe() {
			return descriptors;
		},
		async call(tool, args, context) {
			let reply = await connection.request({
				method: "call",
				tool,
				args,
				workspaceRoot: context.workspace.root,
			});
			if (isFailure(reply)) return reply;
			return success(reply.data as Value);
		},
		async dispose() {
			// Kill the child and fail any in-flight request; the runner calls this
			// once after the whole suite, so the launched process never lingers.
			connection.kill();
		},
	});
}

/**
 * The plugin-side serve loop: read requests from stdin, dispatch each to the
 * given local plugin, and write replies to stdout in the order received. Any
 * Bun script becomes an external plugin by calling this with its plugin
 * implementation; the loop resolves when the host closes stdin.
 *
 * @param plugin - The local plugin implementation to expose over the wire.
 */
export async function servePlugin(plugin: Plugin): Promise<undefined> {
	for await (let line of readLines(Bun.stdin.stream())) {
		if (line.trim() === "") continue;
		let request = parseWireRequest(line);
		// A malformed line has no id to reply to; skipping it beats replying
		// with a guessed id. Well-behaved hosts never send one.
		if (request === null) continue;
		if (request.method === "describe") {
			writeReply({ id: request.id, result: plugin.describe() });
			continue;
		}
		if (request.method === "call") {
			let outcome = await plugin.call(
				request.tool ?? "",
				request.args ?? [],
				createWireContext(request.workspaceRoot ?? ""),
			);
			if (isSuccess(outcome)) {
				writeReply({ id: request.id, result: outcome.data });
			} else {
				writeReply({
					id: request.id,
					error: { code: outcome.error.code, message: outcome.error.message },
				});
			}
			continue;
		}
		writeReply({
			id: request.id,
			error: { code: "usage-error", message: `Unknown method "${request.method}"` },
		});
	}
	return undefined;
}

/** Wire one spawned child into a request/reply connection. */
function openConnection(child: PluginProcess): Connection {
	let nextId = 1;
	let closed = false;
	let pending = new Map<number, PendingReply>();

	function settle(id: number, outcome: Result<unknown, SpecError>): undefined {
		let entry = pending.get(id);
		if (entry === undefined) return undefined;
		pending.delete(id);
		entry.settle(outcome);
		return undefined;
	}

	function close(error: SpecError): undefined {
		if (closed) return undefined;
		closed = true;
		for (let id of pending.keys()) settle(id, failure(error));
		return undefined;
	}

	async function pumpReplies(): Promise<undefined> {
		try {
			for await (let line of readLines(child.stdout)) {
				if (line.trim() === "") continue;
				let reply = parseWireReply(line);
				if (reply === null) {
					close(
						new ToolError(
							`The plugin broke the wire protocol with a malformed reply line: ${truncate(line)}`,
						),
					);
					child.kill();
					return undefined;
				}
				if ("error" in reply) {
					settle(reply.id, failure(reconstructWireError(reply.error)));
				} else {
					settle(reply.id, success(reply.result));
				}
			}
			close(new ToolError("The plugin process closed the connection"));
		} catch (error) {
			close(new ToolError(`Reading from the plugin failed: ${errorMessage(error)}`));
		}
		return undefined;
	}

	void pumpReplies();

	return {
		request(body, timeoutMs) {
			if (closed) {
				return Promise.resolve(failure(new ToolError("The plugin process is no longer running")));
			}
			let id = nextId;
			nextId += 1;
			return new Promise((resolve) => {
				let timer: ReturnType<typeof setTimeout> | undefined;
				pending.set(id, {
					settle(outcome) {
						if (timer !== undefined) clearTimeout(timer);
						resolve(outcome);
					},
				});
				if (timeoutMs !== undefined) {
					timer = setTimeout(() => {
						settle(
							id,
							failure(
								new ToolError(`The plugin did not reply to "${body.method}" within ${timeoutMs}ms`),
							),
						);
					}, timeoutMs);
				}
				try {
					child.stdin.write(`${JSON.stringify({ id, ...body })}\n`);
					child.stdin.flush();
				} catch (error) {
					settle(
						id,
						failure(new ToolError(`Writing to the plugin failed: ${errorMessage(error)}`)),
					);
				}
			});
		},
		kill() {
			try {
				child.kill();
			} catch {
				// Killing an already-dead child is not a failure.
			}
			close(new ToolError("The plugin connection was closed"));
		},
	};
}

/**
 * Build the `ToolContext` the serving side hands its local plugin. The wire
 * carries only the workspace root: relative paths resolve inside it and
 * traversal out is refused, but the caller's actual grants never cross the
 * wire, so the permission checks answer permissively — the runtime's coarse
 * `requires` gate already ran host-side, and scoped enforcement over the wire
 * is an open question tracked in the design suite.
 */
function createWireContext(workspaceRoot: string): ToolContext {
	let workspace: Workspace = {
		root: workspaceRoot,
		resolve(target) {
			if (path.isAbsolute(target)) {
				return failure(
					new PermissionDeniedError("host-fs", target, "spec run --allow-host-fs=<directory>"),
				);
			}
			let resolved = path.resolve(workspaceRoot, target);
			let relative = path.relative(workspaceRoot, resolved);
			if (relative === ".." || relative.startsWith(`..${path.sep}`)) {
				return failure(new WorkspaceEscapeError(target));
			}
			return success(resolved);
		},
		async cleanup() {
			return undefined;
		},
	};
	let permissions: PermissionSet = {
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
	};
	return { workspace, permissions };
}

/** Write one reply line to stdout, the serving side's half of the wire. */
function writeReply(reply: WireReply): undefined {
	process.stdout.write(`${JSON.stringify(reply)}\n`);
	return undefined;
}

/**
 * Split a byte stream into newline-delimited lines.
 *
 * @yields One line at a time, without its terminating newline.
 */
async function* readLines(
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, undefined, undefined> {
	let decoder = new TextDecoder();
	let buffer = "";
	for await (let chunk of stream) {
		buffer += decoder.decode(chunk, { stream: true });
		let index = buffer.indexOf("\n");
		while (index !== -1) {
			yield buffer.slice(0, index);
			buffer = buffer.slice(index + 1);
			index = buffer.indexOf("\n");
		}
	}
	buffer += decoder.decode();
	if (buffer.length > 0) yield buffer;
	return undefined;
}

/** Parse one plugin→host reply line; null means the line broke the protocol. */
function parseWireReply(line: string): WireReply | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	let record = parsed as { id?: unknown; result?: unknown; error?: unknown };
	if (typeof record.id !== "number") return null;
	if ("error" in record) {
		if (typeof record.error !== "object" || record.error === null) return null;
		let wire = record.error as { code?: unknown; message?: unknown };
		return {
			id: record.id,
			error: {
				code: typeof wire.code === "string" ? wire.code : "tool-error",
				message:
					typeof wire.message === "string"
						? wire.message
						: "The plugin reported an error without a message",
			},
		};
	}
	return { id: record.id, result: record.result ?? null };
}

/** Parse one host→plugin request line; null means it broke the protocol. */
function parseWireRequest(line: string): WireRequest | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	let record = parsed as {
		id?: unknown;
		method?: unknown;
		tool?: unknown;
		args?: unknown;
		workspaceRoot?: unknown;
	};
	if (typeof record.id !== "number" || typeof record.method !== "string") return null;
	return {
		id: record.id,
		method: record.method,
		tool: typeof record.tool === "string" ? record.tool : undefined,
		args: Array.isArray(record.args) ? (record.args as ToolArg[]) : undefined,
		workspaceRoot: typeof record.workspaceRoot === "string" ? record.workspaceRoot : undefined,
	};
}

/** Rebuild a `SpecError` from its wire form, defaulting unknown codes. */
function reconstructWireError(wire: { code: string; message: string }): SpecError {
	let code: DiagnosticCode = WIRE_CODES.has(wire.code)
		? (wire.code as DiagnosticCode)
		: "tool-error";
	return new SpecError(code, wire.message);
}

/** Render an unknown thrown value as a one-line message. */
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Cap a wire line for inclusion in an error message. */
function truncate(line: string): string {
	if (line.length <= 120) return line;
	return `${line.slice(0, 120)}…`;
}
