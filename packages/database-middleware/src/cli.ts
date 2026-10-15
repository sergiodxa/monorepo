/**
 * Command-line middleware publishing a `remix/data-table` database as `ctx.db` under the same
 * `Database` key the router and job middleware use, plus a `db` command an app mounts to run SQL
 * against whatever database that middleware connected, one statement or an interactive prompt.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyCommandContext, CommandMiddleware, CommandResult } from "@sdxc/cli";
import type { Database as DataTable, DataManipulationResult } from "remix/data-table";

import { CancelledError, command, createCommand, failure, flag, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { Database } from "./index.js";

export { Database } from "./index.js";

declare module "@sdxc/cli" {
	interface CommandContext {
		/** The database the `database()` middleware published for this run. */
		readonly db: DataTable;
	}
}

/** Installs the database as `ctx.db`, the name every host's context shares. */
const DB_PROPERTY = { property: "db" } as const;

/**
 * Publishes the database on every command run as `ctx.db`. A function is called once per run,
 * so a connection opens only for a command that gets past parsing and help.
 *
 * @param db The database every command reads through, or a function opening it for each run.
 * @returns Command middleware setting the database under {@link Database} and as `ctx.db`.
 * @example createCLI({ name: "app", commands, middleware: [database(() => openDatabase())] });
 */
export function database(
	db: DataTable | (() => DataTable),
): CommandMiddleware<{ key: typeof Database; value: DataTable; property: "db" }> {
	return async (ctx, next) => {
		ctx.set(Database, typeof db === "function" ? db() : db, DB_PROPERTY);
		await next();
	};
}

/** What the interactive prompt reads as the end of the session. */
const EXIT_WORDS: ReadonlySet<string> = new Set([".exit", ".quit"]);

/**
 * The `db` command's declaration, for an app to place in its contract under any name. A run
 * with `--execute` executes that one statement; without it, a prompt reads statements until
 * `.exit`, `.quit` or Ctrl+C, and a run without a terminal ends at once.
 *
 * @example let contract = commands({ db: DB_COMMAND, users: commands({ … }) });
 */
export const DB_COMMAND = command({
	description: "Run SQL against the app's database",
	flags: {
		execute: flag.string("execute", {
			short: "e",
			valueName: "sql",
			description: "Run one statement and exit",
		}),
	},
	examples: ["db", 'db --execute "SELECT count(*) FROM users"'],
});

/**
 * Runs the {@link DB_COMMAND} on the database `database()` published, printing a read's rows as
 * a table on stdout and a write's affected count. With `--execute`, a statement the database
 * rejects fails the run; at the prompt, the error is printed and the prompt continues.
 *
 * @example cli.map(contract.db, dbHandler);
 */
export const dbHandler = createCommand(DB_COMMAND, async (ctx) => {
	let db = ctx.get(Database);
	if (db === undefined) {
		return failure(new Error("The db command needs database() in the CLI's middleware"));
	}

	if (ctx.flags.execute !== undefined) return execute(ctx, db, ctx.flags.execute);

	while (true) {
		let answer = await ctx.prompt.text({
			message: "sql>",
			name: "sql",
			default: ".exit",
			initial: "",
		});
		if (isFailure(answer)) {
			return answer.error instanceof CancelledError ? success() : answer;
		}
		let statement = answer.data.trim();
		if (EXIT_WORDS.has(statement)) return success();
		if (statement === "") continue;

		let result = await execute(ctx, db, statement);
		if (isFailure(result)) ctx.stderr(`${ctx.style.stderr.red(result.error.message)}\n`);
	}
});

/**
 * Executes one statement and prints its outcome, answering the database's error as a failure.
 *
 * @param ctx The run whose stdout receives the output.
 * @param db The database the statement runs on.
 * @param statement The SQL, passed to the database exactly as typed.
 */
async function execute(
	ctx: AnyCommandContext,
	db: DataTable,
	statement: string,
): Promise<CommandResult> {
	let result: DataManipulationResult;
	try {
		result = await db.exec(statement);
	} catch (error) {
		return failure(new Error(describeError(error), { cause: error }));
	}
	ctx.stdout(formatResult(result, ctx.style.bold));
	return success();
}

/**
 * Joins an error's message with those of its causes, since a data-table adapter wraps the
 * driver's error (`no such table: users`) in a generic one.
 *
 * @param error What the database threw.
 * @returns `Database execution failed: no such table: users`.
 */
function describeError(error: unknown): string {
	let messages: string[] = [];
	let current = error;
	while (current instanceof Error && messages.length < 5) {
		if (!messages.includes(current.message)) messages.push(current.message);
		current = current.cause;
	}
	if (typeof current === "string") messages.push(current);
	return messages.length === 0 ? "The database rejected the statement" : messages.join(": ");
}

/**
 * Renders a statement's outcome: rows as aligned columns under a header, followed by the row
 * count, or the affected count for a statement that reads nothing.
 *
 * @param result What the database answered.
 * @param bold Paints the header row.
 * @returns The text to print, ending in a newline.
 */
function formatResult(
	result: DataManipulationResult,
	bold: (text: string) => string = (text) => text,
): string {
	if (result.rows === undefined) {
		let count = result.affectedRows ?? 0;
		return `${count} ${count === 1 ? "row" : "rows"} affected\n`;
	}

	let rows = result.rows;
	let footer = `(${rows.length} ${rows.length === 1 ? "row" : "rows"})\n`;
	let columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
	if (columns.length === 0) return footer;

	let cells = rows.map((row) => columns.map((column) => formatValue(row[column])));
	let widths = columns.map((column, index) =>
		Math.max(column.length, ...cells.map((line) => line[index]?.length ?? 0)),
	);
	let line = (values: readonly string[]) =>
		values
			.map((value, index) => value.padEnd(widths[index] ?? 0))
			.join("  ")
			.trimEnd();

	return [
		bold(line(columns)),
		widths.map((width) => "-".repeat(width)).join("  "),
		...cells.map(line),
		footer,
	].join("\n");
}

/**
 * Renders one value on a single line: `NULL` for SQL null, a byte count for a blob, JSON for any
 * other non-string, so every cell stays one terminal row.
 *
 * @param value A column's value as the database answered it.
 */
function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "string") return value.replaceAll("\n", "\\n");
	if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;
	if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
		return value.toString();
	}
	return JSON.stringify(value) ?? "";
}
