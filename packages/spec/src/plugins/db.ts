/**
 * The built-in `db` capability: run SQL against one of the run's configured
 * database connections. A spec names the SQL and, where more than one
 * connection exists, which one with `on "web"`; `spec/config.jsonc` decides
 * what that name points at, so the DSN never appears in a spec. Reaching a
 * connection is its own privileged act, gated by `--allow-db` scoped to the
 * connection's name, and `run_file` adds `--allow-host-fs` for the seed file
 * it reads. Connections open lazily on first use, are pooled per name for the
 * rest of the run by Bun's SQL client, and close in {@link Plugin.dispose}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";

import type { Result } from "@sdxc/result";
import type { SQL } from "bun";

import { failure, isFailure, success } from "@sdxc/result";

import type { Connection } from "../bases.js";
import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { PermissionDeniedError, ToolError } from "../errors.js";

/** The word tagging which configured connection a call runs against. */
const ON_WORD = "on";

/** The word tagging the bind parameters: one scalar, or an array of them. */
const PARAMS_WORD = "params";

/** The word demanding a single row, which turns an assumption into a check. */
const ONE_WORD = "one";

/** Every option word `db.query` accepts, for the unknown-word diagnostic. */
const QUERY_WORDS = [PARAMS_WORD, ON_WORD, ONE_WORD];

const DB_TOOLS: ToolDescriptor[] = [
	{
		name: "query",
		summary: "Run one SQL statement against a configured connection and return its rows.",
		kind: "action",
		requires: "db",
		params: [
			{
				name: "sql",
				kind: "value",
				required: true,
				summary: 'The SQL text to run, typically a """multiline""" string.',
			},
			{
				name: PARAMS_WORD,
				kind: "word",
				required: false,
				summary: "Tag before the value bound to $1, or an array bound to $1, $2, … in order.",
			},
			{
				name: ON_WORD,
				kind: "word",
				required: false,
				summary: "Tag before the name of the connection to run against.",
			},
			{
				name: ONE_WORD,
				kind: "word",
				required: false,
				summary: "Pass the word `one` to return the single row, refusing any other row count.",
			},
		],
	},
	{
		name: "run_file",
		summary:
			"Send a SQL file to a configured connection unparsed, however many statements it holds.",
		kind: "action",
		requires: "db",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Path of the SQL file, resolved against the working directory.",
			},
			{
				name: ON_WORD,
				kind: "word",
				required: false,
				summary: "Tag before the name of the connection to run against.",
			},
		],
	},
];

/**
 * Create the built-in `db` plugin (namespace `"db"`): `db.query` runs one
 * statement and `db.run_file` applies a whole SQL file, each against the
 * connection `on "…"` names, over handles {@link Plugin.dispose} closes.
 */
export function createDbPlugin(): Plugin {
	let connections = new Map<string, SQL>();
	return {
		namespace: "db",
		describe() {
			return DB_TOOLS;
		},
		async call(tool, args, context) {
			if (tool === "query") return await runQueryTool(connections, args, context);
			if (tool === "run_file") return await runFileTool(connections, args, context);
			return failure(new ToolError(`db has no tool named "${tool}"; tools: query, run_file`));
		},
		async dispose() {
			/**
			 * Detach before awaiting so a slow or throwing close cannot leave a
			 * half-closed handle cached for a later call.
			 */
			let closing = [...connections.values()];
			connections.clear();
			for (let handle of closing) {
				try {
					await handle.close();
				} catch {
					/** Best-effort teardown: a failed close must never fail a run. */
				}
			}
		},
	};
}

/** The validated arguments of one `db.query` call. */
interface QueryArguments {
	/** The SQL text exactly as the spec wrote it. */
	sql: string;
	/** The values bound to `$1`, `$2`, …; empty when the call bound none. */
	params: Value[];
	/** The connection name `on "…"` selected, absent when the spec named none. */
	connection: string | undefined;
	/** Whether the call demanded exactly one row with the `one` word. */
	one: boolean;
}

/**
 * Run one `db.query` call: resolve the connection the spec selected, check the
 * grant that names it, then run the statement and shape what came back.
 */
async function runQueryTool(
	connections: Map<string, SQL>,
	args: ToolArg[],
	context: ToolContext,
): Promise<Result<Value, SpecError>> {
	let parsed = readQueryArgs(args);
	if (isFailure(parsed)) return parsed;
	let chosen = context.connections.resolve(parsed.data.connection);
	if (isFailure(chosen)) return chosen;
	/**
	 * The runtime's central gate already refuses the call if the whole `db`
	 * family was denied; this refines that to the one connection actually
	 * reached, so a run granted some other database names the missing one.
	 */
	let allowed = context.permissions.checkDb(chosen.data.name);
	if (isFailure(allowed)) return allowed;
	let handle = await openConnection(connections, chosen.data);
	if (isFailure(handle)) return handle;
	let executed = await execute("query", handle.data, parsed.data.sql, parsed.data.params);
	if (isFailure(executed)) return executed;
	let shaped = shapeResult(executed.data);
	if (!parsed.data.one) return success(shaped);
	return singleRow(shaped, parsed.data.sql);
}

/**
 * Run one `db.run_file` call: it reaches both a database and the host
 * filesystem, so a run missing both grants is told about both at once rather
 * than discovering the second one after granting the first.
 */
async function runFileTool(
	connections: Map<string, SQL>,
	args: ToolArg[],
	context: ToolContext,
): Promise<Result<Value, SpecError>> {
	let parsed = readFileArgs(args);
	if (isFailure(parsed)) return parsed;
	let chosen = context.connections.resolve(parsed.data.connection);
	if (isFailure(chosen)) return chosen;
	let path = resolvePath(process.cwd(), parsed.data.path);
	let allowed = checkFileGrants(context, chosen.data.name, path);
	if (isFailure(allowed)) return allowed;
	let text: string;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		return failure(new ToolError(`db.run_file could not read ${path}: ${describeError(error)}`));
	}
	let handle = await openConnection(connections, chosen.data);
	if (isFailure(handle)) return handle;
	/**
	 * The file's bytes go over unparsed, which the simple query protocol
	 * accepts as the multi-statement string it is. Splitting on `;` would
	 * mangle dollar-quoted bodies and comments, and half-apply a seed.
	 */
	let executed = await execute("run_file", handle.data, text, []);
	if (isFailure(executed)) return executed;
	return success({ affected_rows: fileAffectedRows(executed.data) });
}

/**
 * Check the two grants `db.run_file` needs, reporting a run that holds neither
 * in one denial naming both flags.
 *
 * @param context - The call's context, carrying the run's grants.
 * @param connection - The resolved connection name the file is applied to.
 * @param path - The absolute host path of the SQL file.
 * @returns Nothing when both are granted, else the denial to report.
 */
function checkFileGrants(
	context: ToolContext,
	connection: string,
	path: string,
): Result<undefined, SpecError> {
	let database = context.permissions.checkDb(connection);
	let filesystem = context.permissions.checkHostFs(path);
	if (isFailure(database) && isFailure(filesystem)) {
		return failure(
			new PermissionDeniedError(
				"db",
				connection,
				`spec run --allow-db=${connection} --allow-host-fs=${dirname(path)}`,
			),
		);
	}
	if (isFailure(database)) return database;
	if (isFailure(filesystem)) return filesystem;
	return success(undefined);
}

/**
 * Validate `db.query`'s arguments: the SQL text first, then the `params`,
 * `on`, and `one` words in any order, each accepted once.
 *
 * @param args - The evaluated arguments, in call order.
 * @returns The validated call, or the usage error to report.
 */
function readQueryArgs(args: ToolArg[]): Result<QueryArguments, SpecError> {
	let first = args[0];
	if (first === undefined) {
		return failure(new ToolError("db.query requires the SQL text; got no arguments"));
	}
	if (first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError("db.query expects its first argument to be a SQL string"));
	}
	let sql = first.value;
	let params: Value[] | undefined;
	let connection: string | undefined;
	let one = false;
	let index = 1;
	while (index < args.length) {
		let arg = args[index];
		if (arg === undefined) break;
		if (arg.kind !== "word") {
			return failure(
				new ToolError(
					`db.query takes one SQL string; tag anything after it with one of ${QUERY_WORDS.join(", ")}`,
				),
			);
		}
		if (arg.word === ONE_WORD) {
			one = true;
			index += 1;
			continue;
		}
		if (arg.word !== PARAMS_WORD && arg.word !== ON_WORD) {
			return failure(
				new ToolError(
					`db.query got the unknown option word "${arg.word}"; expected one of ${QUERY_WORDS.join(", ")}`,
				),
			);
		}
		let next = args[index + 1];
		if (next === undefined || next.kind !== "value") {
			return failure(
				new ToolError(`db.query option "${arg.word}" needs a value argument after it`),
			);
		}
		if (arg.word === ON_WORD) {
			if (connection !== undefined) {
				return failure(new ToolError("db.query accepts at most one connection name"));
			}
			if (typeof next.value !== "string") {
				return failure(new ToolError('db.query expects a connection name string after "on"'));
			}
			connection = next.value;
		} else {
			if (params !== undefined) {
				return failure(new ToolError("db.query accepts at most one params list"));
			}
			let read = readParams(next.value);
			if (isFailure(read)) return read;
			params = read.data;
		}
		index += 2;
	}
	return success({ sql, params: params ?? [], connection, one });
}

/** The validated arguments of one `db.run_file` call. */
interface FileArguments {
	/** The file path exactly as the spec wrote it. */
	path: string;
	/** The connection name `on "…"` selected, absent when the spec named none. */
	connection: string | undefined;
}

/**
 * Validate `db.run_file`'s arguments: the path first, then an optional
 * `on "name"`.
 *
 * @param args - The evaluated arguments, in call order.
 * @returns The validated call, or the usage error to report.
 */
function readFileArgs(args: ToolArg[]): Result<FileArguments, SpecError> {
	let first = args[0];
	if (first === undefined) {
		return failure(new ToolError("db.run_file requires the path of a SQL file; got no arguments"));
	}
	if (first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError("db.run_file expects its first argument to be a path string"));
	}
	let rest = args.slice(1);
	if (rest.length === 0) return success({ path: first.value, connection: undefined });
	let [tag, name, ...extra] = rest;
	if (tag === undefined || tag.kind !== "word" || tag.word !== ON_WORD) {
		return failure(
			new ToolError(
				`db.run_file takes one path; select a connection after it with ${ON_WORD} "name"`,
			),
		);
	}
	if (name === undefined || name.kind !== "value" || typeof name.value !== "string") {
		return failure(new ToolError('db.run_file expects a connection name string after "on"'));
	}
	if (extra.length > 0) {
		return failure(new ToolError("db.run_file accepts at most one connection name"));
	}
	return success({ path: first.value, connection: name.value });
}

/**
 * Read the `params` argument as a bind list: an array binds `$1`, `$2`, … in
 * order and any scalar binds `$1` alone, which is the shape a single-parameter
 * lookup wants without wrapping.
 *
 * @param value - The value the `params` word tagged.
 * @returns The bind list, or the usage error for a value SQL cannot bind.
 */
function readParams(value: Value): Result<Value[], SpecError> {
	if (Array.isArray(value)) return success([...value]);
	if (typeof value === "object" && value !== null) {
		return failure(
			new ToolError(
				"db.query binds params positionally, so it takes one scalar or an array of them; got an object",
			),
		);
	}
	return success([value]);
}

/**
 * Return the row a `one` query promised, refusing any other count.
 *
 * @param shaped - The shaped query result.
 * @param sql - The statement that ran, quoted back in the failure.
 * @returns The single row, or the error naming how many rows came back.
 */
function singleRow(shaped: ValueObject, sql: string): Result<Value, SpecError> {
	let rows = shaped.rows;
	if (Array.isArray(rows) && rows.length === 1) return success(rows[0] ?? null);
	let count = Array.isArray(rows) ? rows.length : 0;
	return failure(
		new ToolError(`db.query asked for one row and got ${count}: ${JSON.stringify(sql)}`),
	);
}

/**
 * Open a pooled handle for a connection, reusing the one already opened under
 * that name so every call in a run shares a session.
 *
 * @param connections - The handles opened so far, keyed by connection name.
 * @param connection - The resolved connection to reach.
 * @returns The handle, or the error that prevented opening it.
 */
async function openConnection(
	connections: Map<string, SQL>,
	connection: Connection,
): Promise<Result<SQL, SpecError>> {
	let existing = connections.get(connection.name);
	if (existing !== undefined) return success(existing);
	try {
		/** The client loads inside this call so the module works under any runtime. */
		let { SQL } = await import("bun");
		let opened = new SQL(connection.url);
		connections.set(connection.name, opened);
		return success(opened);
	} catch (error) {
		return failure(
			new ToolError(
				`db could not open the connection ${JSON.stringify(connection.name)}: ${describeError(error)}`,
			),
		);
	}
}

/**
 * Run SQL on a handle, binding parameters when the call supplied any.
 *
 * A bind list moves the statement onto the extended protocol, which takes one
 * statement; an empty list keeps the simple protocol, which is what lets a
 * whole file go over in one call.
 *
 * @param tool - The tool the call came through, named in a failure.
 * @param handle - The pooled connection to run on.
 * @param text - The SQL text to send.
 * @param params - The values bound to `$1`, `$2`, …, empty to bind none.
 * @returns The driver's own result, or the database's account of the failure.
 */
async function execute(
	tool: string,
	handle: SQL,
	text: string,
	params: Value[],
): Promise<Result<unknown, SpecError>> {
	try {
		if (params.length === 0) return success(await handle.unsafe<unknown>(text));
		return success(await handle.unsafe<unknown>(text, params));
	} catch (error) {
		return failure(new ToolError(`db.${tool} failed: ${describeError(error)}`));
	}
}

/**
 * Shape a driver result into the tool's value: `rows` are the returned
 * records (empty for DML), `affected_rows` is the driver's row count, and
 * `count` is `rows.length`.
 */
function shapeResult(result: unknown): ValueObject {
	let rows: Value[] = [];
	if (Array.isArray(result)) {
		for (let row of result) rows.push(toValue(row));
	}
	return { rows, affected_rows: affectedRows(result, rows.length), count: rows.length };
}

/**
 * How many rows a whole file changed. A driver answering a multi-statement
 * send with one result per statement is summed across them; one answering with
 * a single flat result already carries the total.
 */
function fileAffectedRows(result: unknown): number {
	if (!Array.isArray(result)) return 0;
	if (!isPerStatementResult(result)) return affectedRows(result, result.length);
	return result.reduce<number>((total, statement) => total + affectedRows(statement, 0), 0);
}

/**
 * Whether a driver answered a multi-statement send with one result per
 * statement: every element is itself a result array, and the outer array
 * carries no row count of its own.
 */
function isPerStatementResult(result: unknown[]): boolean {
	if ((result as { count?: unknown }).count !== undefined) return false;
	return result.length > 0 && result.every((statement) => Array.isArray(statement));
}

/**
 * The driver's affected/returned-row count. Bun attaches `count` to the result
 * array — the rows changed by DML, or the rows a SELECT returned; fall back to
 * the row count when a driver omits it.
 */
function affectedRows(result: unknown, fallback: number): number {
	if (typeof result === "object" && result !== null) {
		let count = (result as { count?: unknown }).count;
		if (typeof count === "number" && Number.isFinite(count)) return count;
		if (typeof count === "bigint") return Number(count);
	}
	return fallback;
}

/**
 * Coerce a driver-returned value into the JSON-shaped runtime {@link Value}
 * model — dates to ISO strings, binary to base64, safe bigints to numbers
 * and unsafe ones to strings — so every row is a plain, comparable value.
 */
function toValue(value: unknown): Value {
	if (value === null || value === undefined) return null;
	if (typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "bigint") {
		let inRange =
			value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER);
		return inRange ? Number(value) : value.toString();
	}
	if (value instanceof Date) return value.toISOString();
	if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
	if (Array.isArray(value)) return value.map(toValue);
	if (typeof value === "object") {
		let object: ValueObject = {};
		for (let [key, entry] of Object.entries(value)) object[key] = toValue(entry);
		return object;
	}
	if (typeof value === "symbol" || typeof value === "function") return value.toString();

	/** Every `typeof` result is handled above, so nothing reaches here. */
	return null;
}

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
