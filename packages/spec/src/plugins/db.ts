/**
 * The built-in `db` capability: run raw SQL against a database whose location
 * the operator supplies through the `DATABASE_URL` environment variable. The
 * spec never chooses the destination — it names `db.query` and asserts on the
 * result — so revealing the connection string is the whole privileged act, and
 * the family is gated by `env` alone (no `net`, no `run`). The connection is
 * opened lazily on the first query, pooled and reused across the run by Bun's
 * SQL client, and closed once in {@link Plugin.dispose}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SQL } from "bun";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolDescriptor } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { ToolError } from "../errors.js";

const DATABASE_URL_VAR = "DATABASE_URL";

const DB_TOOLS: ToolDescriptor[] = [
	{
		name: "query",
		summary: "Run a raw SQL statement against DATABASE_URL and return its rows and counts.",
		kind: "action",
		requires: "env",
		params: [
			{
				name: "sql",
				kind: "value",
				required: true,
				summary: 'The SQL text to run, typically a """multiline""" string.',
			},
		],
	},
];

/**
 * Create the built-in `db` plugin (namespace `"db"`): a single `db.query`
 * tool returning `{ rows, affected_rows, count }` from one pooled connection
 * opened from `DATABASE_URL` and closed via {@link Plugin.dispose}.
 */
export function createDbPlugin(): Plugin {
	let connection: SQL | null = null;
	return {
		namespace: "db",
		describe() {
			return DB_TOOLS;
		},
		async call(tool, args, context) {
			if (tool !== "query") {
				return failure(new ToolError(`db has no tool named "${tool}"; tools: query`));
			}
			let text = readSql(args);
			if (isFailure(text)) return text;
			/**
			 * The runtime's central gate already refuses the call if the whole `env`
			 * family was denied; this refines that to the one variable actually read,
			 * so granting some other variable still yields the exact missing name.
			 */
			let allowed = context.permissions.checkEnv(DATABASE_URL_VAR);
			if (isFailure(allowed)) return allowed;
			let url = process.env[DATABASE_URL_VAR];
			if (url === undefined || url.trim().length === 0) {
				return failure(
					new ToolError(
						`db.query reads its connection string from the ${DATABASE_URL_VAR} environment variable, which is unset or empty; set it, e.g. ${DATABASE_URL_VAR}=… spec run --allow-env=${DATABASE_URL_VAR}`,
					),
				);
			}
			if (connection === null) {
				let opened = await openConnection(url);
				if (isFailure(opened)) return opened;
				connection = opened.data;
			}
			return await runQuery(connection, text.data);
		},
		async dispose() {
			if (connection === null) return;
			/**
			 * Detach before awaiting so a slow or throwing close cannot leave a
			 * half-closed handle cached for a later call.
			 */
			let closing = connection;
			connection = null;
			try {
				await closing.close();
			} catch {
				/** Best-effort teardown: a failed close must never fail a run. */
			}
		},
	};
}

/**
 * Validate `db.query`'s arguments: exactly one value argument, a string. Words
 * are meaningless to a SQL runner, and a missing or non-string argument is a
 * usage error, all reported as {@link ToolError}s the reporter renders inline.
 */
function readSql(args: ToolArg[]): Result<string, SpecError> {
	if (args.length !== 1) {
		return failure(
			new ToolError(`db.query takes exactly one argument, the SQL text; got ${args.length}`),
		);
	}
	let arg = args[0];
	if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
		return failure(new ToolError("db.query expects its single argument to be a SQL string"));
	}
	return success(arg.value);
}

/**
 * Open a pooled connection to `url`, translating a malformed URL,
 * unsupported scheme, or missing SQL client into a {@link ToolError}. The
 * client loads inside this call so the module works under any runtime.
 */
async function openConnection(url: string): Promise<Result<SQL, SpecError>> {
	try {
		let { SQL } = await import("bun");
		return success(new SQL(url));
	} catch (error) {
		return failure(
			new ToolError(`db.query could not open a database connection: ${describeError(error)}`),
		);
	}
}

/**
 * Run one raw SQL statement on the connection and shape the driver's result.
 * A SQL or connection error surfaces as a {@link ToolError} carrying the
 * database's own message, so the failing test reports what the database said.
 */
async function runQuery(connection: SQL, text: string): Promise<Result<Value, SpecError>> {
	let result: unknown;
	try {
		result = await connection.unsafe<unknown>(text);
	} catch (error) {
		return failure(new ToolError(`db.query failed: ${describeError(error)}`));
	}
	return success(shapeResult(result));
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
