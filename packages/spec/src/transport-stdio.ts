/**
 * The NDJSON-over-stdio plugin transport: how an external executable becomes
 * a `Plugin`, one JSON document per line over the child's stdio, with
 * strictly increasing request ids and in-order replies. The child inherits
 * no environment beyond PATH.
 *
 * The whole tool context crosses as plain data and the serving side rebuilds
 * it, so a plugin here reads the workspace, run identity, bases and
 * connections a built-in reads. A permission family whose scopes the context
 * enumerates — `db`, over the configured connections — crosses exactly; the
 * open-ended families cross granted, behind the host's `requires` gate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import path from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";

import type { Base, Connection } from "./bases.js";
import type { DiagnosticCode } from "./errors.js";
import type { Grant, Grants, PermissionKind } from "./permissions.js";
import type { Plugin, RunIdentity, ToolContext, ToolDescriptor } from "./plugin.js";
import type { ToolArg, Value } from "./values.js";
import type { Workspace } from "./workspace.js";

import { createArtifactStore } from "./artifacts.js";
import { createBaseSet, createConnectionSet } from "./bases.js";
import { PermissionDeniedError, SpecError, ToolError, WorkspaceEscapeError } from "./errors.js";
import { createPermissionSet } from "./permissions.js";

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
	stdin: { write(chunk: string): unknown };
	/** The pipe the plugin writes replies into, read as newline-delimited bytes. */
	stdout: AsyncIterable<Uint8Array>;
	kill(): void;
}

/** The seed a served plugin's stream opens on. */
const WIRE_SEED = "spec-plugin";

/** The plain data behind a {@link ToolContext}, as one `call` carries it. */
interface WireContext {
	/** The absolute workspace root the test's relative paths resolve inside. */
	workspaceRoot: string;
	/** The test's frozen instant, as an ISO timestamp. */
	now: string;
	/** What the run and this attempt are called. */
	run: RunIdentity;
	/** The configured bases, in config order. */
	bases: Base[];
	/** The configured database connections, in config order. */
	connections: Connection[];
	/** The grants the far side enforces, as {@link describeContext} derives them. */
	grants: Grants;
	/** Where failure artifacts go, absent when the run collects none. */
	artifactsDirectory?: string;
}

/** The body of a host→plugin request, before an id is assigned. */
interface WireRequestBody {
	method: "describe" | "call";
	/** The tool name, for `call` requests. */
	tool?: string;
	/** The evaluated arguments, for `call` requests. */
	args?: ToolArg[];
	/** The caller's context, for `call` requests. */
	context?: WireContext;
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
	/** The caller's context, defaulted where the request left a part out. */
	context: WireContext;
}

/** The identity a request that carries none falls back to. */
const UNIDENTIFIED_RUN: RunIdentity = { id: "run", attempt: 1, nonce: "run-1" };

/** The grants a request that carries none falls back to: a run granted nothing. */
const NOTHING_GRANTED: Grants = {
	run: { mode: "denied" },
	net: { mode: "denied" },
	env: { mode: "denied" },
	hostFs: { mode: "denied" },
	db: { mode: "denied" },
};

/**
 * A failure as it crosses the wire. The remedy travels with the code because a
 * denial that cannot name the flag that would grant it is not a denial a reader
 * can act on, and a plugin's denials are the ones a caller is least able to
 * guess at.
 */
interface WireError {
	/** The {@link DiagnosticCode}, defaulted to `tool-error` when unknown. */
	code: string;
	/** The plugin's own account of the failure. */
	message: string;
	/** The permission family a denial required, when it was one. */
	permission?: string;
	/** What the spec attempted to reach, when the failure was a denial. */
	resource?: string;
	/** The exact `spec run --allow-*` flag that would grant the attempt. */
	remedy?: string;
	/** Whether the coarse family gate raised the denial before the resource was known. */
	familyGate?: boolean;
}

/** A plugin→host reply: a result or a coded error, never both. */
type WireReply = { id: number; result: unknown } | { id: number; error: WireError };

/** One in-flight request awaiting its reply. */
interface PendingReply {
	/** Deliver the reply (or the failure that stands in for it) exactly once. */
	settle(outcome: Result<unknown, SpecError>): void;
}

/** The host side of one child's wire: sequenced requests over the pipes. */
interface WireConnection {
	/** Send one request and await its matching reply. */
	request(body: WireRequestBody, timeoutMs?: number): Promise<Result<unknown, SpecError>>;
	/** Kill the child and fail everything still in flight. */
	kill(): void;
}

/**
 * Spawn an external plugin process and connect it as a `Plugin`: send the
 * describe handshake (5s timeout), cache the returned descriptors, and hand
 * back a `call()` that round-trips over the child's stdio.
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
		child = await spawnChild(command);
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
				context: describeContext(context),
			});
			if (isFailure(reply)) return reply;
			return success(reply.data as Value);
		},
		/**
		 * Kills the child and fails any in-flight request. The runner calls this
		 * once after the suite, so the launched process never lingers.
		 */
		async dispose() {
			connection.kill();
		},
	});
}

/**
 * The plugin-side serve loop: read requests from stdin, dispatch each to the
 * given plugin, and write matching replies to stdout, in order. A line that
 * fails to parse carries no id, so parsing simply continues to the next one.
 *
 * @param plugin - The local plugin implementation to expose over the wire.
 */
export async function servePlugin(plugin: Plugin): Promise<undefined> {
	for await (let line of readLines(process.stdin)) {
		if (line.trim() === "") continue;
		let request = parseWireRequest(line);
		if (request === null) continue;
		if (request.method === "describe") {
			writeReply({ id: request.id, result: plugin.describe() });
			continue;
		}
		if (request.method === "call") {
			let outcome = await plugin.call(
				request.tool ?? "",
				request.args ?? [],
				createWireContext(request.context),
			);
			if (isSuccess(outcome)) {
				writeReply({ id: request.id, result: outcome.data });
			} else {
				writeReply({ id: request.id, error: describeWireError(outcome.error) });
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

/**
 * Spawn a plugin command, resolving only once the OS confirms it started, so
 * a bad executable fails here instead of later. It inherits nothing but
 * PATH; a mid-call exit's broken stdin pipe surfaces via the pending request.
 *
 * @param command - The argv to spawn, first element being the executable.
 * @returns The started child, narrowed to what the transport reads and writes.
 * @throws When the executable cannot be started.
 */
async function spawnChild(command: string[]): Promise<PluginProcess> {
	let child = spawn(command[0] ?? "", command.slice(1), {
		stdio: ["pipe", "pipe", "ignore"],
		env: { PATH: process.env.PATH ?? "" },
	});
	child.stdin?.on("error", () => {});
	let failed = await new Promise<Error | undefined>((settle) => {
		child.once("spawn", () => settle(undefined));
		child.once("error", (error: Error) => settle(error));
	});
	if (failed !== undefined) throw failed;
	let stdin = child.stdin;
	let stdout = child.stdout;
	if (stdin === null || stdout === null) {
		child.kill();
		throw new Error("the child was started without usable stdio pipes");
	}
	return {
		stdin,
		stdout,
		kill() {
			child.kill();
		},
	};
}

/** Wire one spawned child into a request/reply connection. */
function openConnection(child: PluginProcess): WireConnection {
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
				} catch (error) {
					settle(
						id,
						failure(new ToolError(`Writing to the plugin failed: ${errorMessage(error)}`)),
					);
				}
			});
		},
		/** An already-exited child counts as killed too, so the close below always runs. */
		kill() {
			try {
				child.kill();
			} catch {}
			close(new ToolError("The plugin connection was closed"));
		},
	};
}

/**
 * Reduce the caller's context to the plain data a `call` carries.
 *
 * A grant crosses as scopes the far side can check for itself, which the `db`
 * family allows because a query only ever names a configured connection. The
 * open-ended families cross granted, so the host's `requires` gate and its own
 * `PermissionSet` remain the ones that refuse a call.
 *
 * @param context - The context the host handed this call.
 * @returns The context as one JSON document.
 */
function describeContext(context: ToolContext): WireContext {
	let wire: WireContext = {
		workspaceRoot: context.workspace.root,
		now: context.now.toISOString(),
		run: context.run,
		bases: context.bases.list(),
		connections: context.connections.list(),
		grants: {
			run: { mode: "all" },
			net: { mode: "all" },
			env: { mode: "all" },
			hostFs: { mode: "all" },
			db: grantedConnections(context),
		},
	};
	if (context.artifacts !== undefined) wire.artifactsDirectory = context.artifacts.directory;
	return wire;
}

/** The configured connections this caller may reach, as a `db` grant. */
function grantedConnections(context: ToolContext): Grant {
	let scopes: string[] = [];
	for (let connection of context.connections.list()) {
		if (isSuccess(context.permissions.checkDb(connection.name))) scopes.push(connection.name);
	}
	return { mode: "scoped", scopes };
}

/**
 * Build the `ToolContext` the serving side hands its local plugin, rebuilding
 * every part the host sent: relative paths resolve inside the forwarded
 * workspace root and traversal out is refused, and bases, connections and
 * grants behave as the host's own.
 *
 * The instant crosses the wire, so a plugin here reads the same time the test
 * started. The stream does not: it opens on a fixed seed, giving a served
 * plugin values that repeat run to run. Carrying the host's stream position
 * across a process boundary waits for a plugin that generates data.
 */
function createWireContext(wire: WireContext): ToolContext {
	let workspaceRoot = wire.workspaceRoot;
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
	let context: ToolContext = {
		workspace,
		permissions: createPermissionSet(wire.grants),
		random: createRandom(WIRE_SEED),
		now: new Date(wire.now),
		run: wire.run,
		bases: createBaseSet(wire.bases),
		connections: createConnectionSet(wire.connections),
	};
	if (wire.artifactsDirectory !== undefined) {
		context.artifacts = createArtifactStore(wire.artifactsDirectory);
	}
	return context;
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
	stream: AsyncIterable<Uint8Array>,
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
		let wire = record.error as Record<string, unknown>;
		let error: WireError = {
			code: typeof wire.code === "string" ? wire.code : "tool-error",
			message:
				typeof wire.message === "string"
					? wire.message
					: "The plugin reported an error without a message",
		};
		if (typeof wire.permission === "string") error.permission = wire.permission;
		if (typeof wire.resource === "string") error.resource = wire.resource;
		if (typeof wire.remedy === "string") error.remedy = wire.remedy;
		if (typeof wire.familyGate === "boolean") error.familyGate = wire.familyGate;
		return { id: record.id, error };
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
		context?: unknown;
	};
	if (typeof record.id !== "number" || typeof record.method !== "string") return null;
	return {
		id: record.id,
		method: record.method,
		tool: typeof record.tool === "string" ? record.tool : undefined,
		args: Array.isArray(record.args) ? (record.args as ToolArg[]) : undefined,
		context: parseWireContext(record.context),
	};
}

/**
 * Read the context off a request, defaulting every part the sender left out,
 * so a host that sends less than the full context still gets a working
 * plugin rather than one that fails on a missing field.
 */
function parseWireContext(value: unknown): WireContext {
	let record = (typeof value === "object" && value !== null ? value : {}) as Partial<WireContext>;
	let wire: WireContext = {
		workspaceRoot: typeof record.workspaceRoot === "string" ? record.workspaceRoot : "",
		now: typeof record.now === "string" ? record.now : new Date().toISOString(),
		run: typeof record.run === "object" && record.run !== null ? record.run : UNIDENTIFIED_RUN,
		bases: Array.isArray(record.bases) ? record.bases : [],
		connections: Array.isArray(record.connections) ? record.connections : [],
		grants:
			typeof record.grants === "object" && record.grants !== null ? record.grants : NOTHING_GRANTED,
	};
	if (typeof record.artifactsDirectory === "string") {
		wire.artifactsDirectory = record.artifactsDirectory;
	}
	return wire;
}

/** Reduce an error to its wire form, keeping what a denial needs to stay actionable. */
function describeWireError(error: SpecError): WireError {
	let wire: WireError = { code: error.code, message: error.message };
	if (error.remedy !== undefined) wire.remedy = error.remedy;
	if (!(error instanceof PermissionDeniedError)) return wire;
	wire.permission = error.permission;
	wire.resource = error.resource;
	wire.familyGate = error.familyGate;
	return wire;
}

/**
 * Rebuild a `SpecError` from its wire form, defaulting unknown codes. A denial
 * comes back as a `PermissionDeniedError` so the reporter groups it with the
 * runtime's own and prints the flag that would grant it.
 */
function reconstructWireError(wire: WireError): SpecError {
	let code: DiagnosticCode = WIRE_CODES.has(wire.code)
		? (wire.code as DiagnosticCode)
		: "tool-error";
	if (
		code === "permission-denied" &&
		wire.permission !== undefined &&
		wire.resource !== undefined
	) {
		let denial = new PermissionDeniedError(
			wire.permission as PermissionKind,
			wire.resource,
			wire.remedy ?? `spec run --allow-${wire.permission}`,
			wire.familyGate ?? false,
		);
		denial.message = wire.message;
		return denial;
	}
	let error = new SpecError(code, wire.message);
	if (wire.remedy !== undefined) error.remedy = wire.remedy;
	return error;
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
