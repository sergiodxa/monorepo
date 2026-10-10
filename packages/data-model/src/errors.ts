/**
 * The failures a model's writes answer, and the mapping from what data-table and the database
 * raise into them, so a caller branches on one `ValidationError` whether a callback, the
 * table's own hooks or a unique index caught the problem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import { ValidationError } from "@sdxc/validate";
import { DataTableConstraintError, DataTableValidationError } from "remix/data-table";

/** No row with the given key exists among the rows the model reads. */
export class NotFound extends Error {
	override name = "NotFound";
	/** The model's name, such as `users` or `posts.article`. */
	readonly model: string;
	/** The key that matched nothing. */
	readonly key: unknown;

	constructor(model: string, key: unknown) {
		super(`No ${model} row matches ${JSON.stringify(key)}`);
		this.model = model;
		this.key = key;
	}
}

/** A thrown failure, so a `before*` callback's refusal aborts the write's database transaction. */
export class WriteAborted extends Error {
	override name = "WriteAborted";
	readonly failure: unknown;

	constructor(failure: unknown) {
		super("The write was aborted by a returned failure");
		this.failure = failure;
	}
}

/**
 * Whether a value is data-table's `fail()` result: an object whose only member is an `issues`
 * array, which is what tells a refusal apart from rewritten values.
 */
export function isCallbackFailure(value: unknown): value is { issues: ReadonlyArray<unknown> } {
	if (typeof value !== "object" || value === null) return false;
	let keys = Object.keys(value);
	return (
		keys.length === 1 &&
		keys[0] === "issues" &&
		Array.isArray((value as { issues: unknown }).issues)
	);
}

/** Normalizes an issue from any source into the Standard Schema shape `ValidationError` holds. */
function toIssue(issue: unknown): StandardSchemaV1.Issue {
	if (typeof issue === "object" && issue !== null && "message" in issue) {
		let { message, path } = issue as { message: unknown; path?: unknown };
		let normalized: StandardSchemaV1.Issue = { message: String(message) };
		if (Array.isArray(path)) return { ...normalized, path: path as PropertyKey[] };
		return normalized;
	}
	return { message: String(issue) };
}

/** Wraps issues from a callback's `fail()` into a `ValidationError`. */
export function toValidationError(issues: ReadonlyArray<unknown>): ValidationError {
	return new ValidationError(issues.map(toIssue));
}

/** The messages a constraint violation reads as, by constraint kind. */
const CONSTRAINT_MESSAGES = {
	unique: "Already taken",
	foreign: "Refers to a record that does not exist",
	notNull: "Required",
	check: "Invalid value",
} as const;

/**
 * SQLite and D1 report the columns (`UNIQUE constraint failed: users.email`), Postgres the
 * constraint's name (`violates unique constraint "idx_users_email"`).
 */
const SQLITE_CONSTRAINT =
	/(UNIQUE|NOT NULL|CHECK|FOREIGN KEY) constraint failed(?::\s*([\w".]+(?:,\s*[\w".]+)*))?/i;

/** Postgres and MySQL name the violated constraint, or the key, in quotes. */
const NAMED_CONSTRAINT = /(unique|foreign key|check|not-null)[^"'`]*["'`]([\w.]+)["'`]/i;

/** Reads the column a constraint name points at: `idx_users_email` and `users_email_key` → `email`. */
function columnFromConstraintName(name: string, table: string): string {
	let column = name
		.replace(/^(idx|uq|uniq|unique|fk|ck|chk)_/i, "")
		.replace(/_(key|idx|index|unique|uniq|fkey|check)$/i, "");
	return column.startsWith(`${table}_`) ? column.slice(table.length + 1) : column;
}

/** Every message in an error's `cause` chain, outermost first. */
function messages(error: unknown): string[] {
	let found: string[] = [];
	let current: unknown = error;
	for (let depth = 0; depth < 8 && current instanceof Error; depth++) {
		found.push(current.message);
		current = current.cause;
	}
	return found;
}

/** Turns one database message into an issue, or `null` when it reports no constraint. */
function constraintIssue(message: string, table: string): StandardSchemaV1.Issue | null {
	let sqlite = SQLITE_CONSTRAINT.exec(message);
	if (sqlite !== null) {
		let kind = (sqlite[1] ?? "").toUpperCase();
		let text =
			kind === "UNIQUE"
				? CONSTRAINT_MESSAGES.unique
				: kind === "NOT NULL"
					? CONSTRAINT_MESSAGES.notNull
					: kind === "CHECK"
						? CONSTRAINT_MESSAGES.check
						: CONSTRAINT_MESSAGES.foreign;
		let first = sqlite[2]?.split(",")[0]?.trim().replaceAll('"', "");
		if (first === undefined || first === "") return { message: text };
		let segments = first.split(".");
		let column = segments.length > 1 ? (segments.at(-1) ?? first) : first;
		return {
			message: text,
			path: [kind === "CHECK" ? columnFromConstraintName(column, table) : column],
		};
	}

	let named = NAMED_CONSTRAINT.exec(message);
	if (named !== null) {
		let kind = (named[1] ?? "").toLowerCase();
		let text =
			kind === "unique"
				? CONSTRAINT_MESSAGES.unique
				: kind === "check"
					? CONSTRAINT_MESSAGES.check
					: kind === "not-null"
						? CONSTRAINT_MESSAGES.notNull
						: CONSTRAINT_MESSAGES.foreign;
		return { message: text, path: [columnFromConstraintName(named[2] ?? "", table)] };
	}

	return null;
}

/**
 * Maps what a write's statement raised into the `ValidationError` a write answers, or `null`
 * for a failure that is not the caller's to handle, which the write rethrows.
 *
 * A table hook's `DataTableValidationError` keeps its issues; a constraint violation, raised as
 * `DataTableConstraintError` or carried in a database error's cause, is reported at the column
 * the constraint covers.
 *
 * @param error What the statement threw.
 * @param table The model's table name, stripped from constraint names.
 */
export function fromWriteError(error: unknown, table: string): ValidationError | null {
	if (error instanceof DataTableValidationError) return toValidationError(error.issues);

	for (let message of messages(error)) {
		let issue = constraintIssue(message, table);
		if (issue !== null) return new ValidationError([issue]);
	}

	if (error instanceof DataTableConstraintError) {
		return new ValidationError([{ message: error.message }]);
	}

	return null;
}
