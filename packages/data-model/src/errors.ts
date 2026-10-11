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

/** The kinds of database constraint a write can violate. */
export type ConstraintKind = "unique" | "foreign-key" | "not-null" | "check";

/**
 * A write the database refused for a constraint. It is a `ValidationError` whose one issue sits
 * at the column the constraint covers, so a form renders it like any other, and its `kind`
 * tells a duplicate (`"unique"`) apart from the other refusals.
 */
export class ConstraintViolation extends ValidationError {
	override name = "ConstraintViolation";
	readonly kind: ConstraintKind;
	/** The column the constraint covers, when the database names it. */
	readonly column: string | undefined;

	constructor(kind: ConstraintKind, issue: StandardSchemaV1.Issue) {
		super([issue]);
		this.kind = kind;
		let [column] = issue.path ?? [];
		this.column = typeof column === "string" ? column : undefined;
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
const CONSTRAINT_MESSAGES: Record<ConstraintKind, string> = {
	unique: "Already taken",
	"foreign-key": "Refers to a record that does not exist",
	"not-null": "Required",
	check: "Invalid value",
};

/**
 * SQLite and D1 report the columns (`UNIQUE constraint failed: users.email`), Postgres the
 * constraint's name (`violates unique constraint "idx_users_email"`).
 */
const SQLITE_CONSTRAINT =
	/(UNIQUE|NOT NULL|CHECK|FOREIGN KEY) constraint failed(?::\s*([\w".]+(?:,\s*[\w".]+)*))?/i;

/** Postgres and MySQL name the violated constraint, or the key, in quotes. */
const NAMED_CONSTRAINT = /(unique|foreign key|check|not-null)[^"'`]*["'`]([\w.]+)["'`]/i;

/** Reads the constraint kind out of the word a database reports it with. */
function kindOf(word: string): ConstraintKind {
	let normalized = word.toLowerCase().replace(" ", "-");
	if (normalized === "unique" || normalized === "check" || normalized === "not-null") {
		return normalized;
	}
	return "foreign-key";
}

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

/** Turns one database message into a violation, or `null` when it reports no constraint. */
function constraintViolation(message: string, table: string): ConstraintViolation | null {
	let sqlite = SQLITE_CONSTRAINT.exec(message);
	if (sqlite !== null) {
		let kind = kindOf(sqlite[1] ?? "");
		let text = CONSTRAINT_MESSAGES[kind];
		let first = sqlite[2]?.split(",")[0]?.trim().replaceAll('"', "");
		if (first === undefined || first === "")
			return new ConstraintViolation(kind, { message: text });
		let segments = first.split(".");
		let column = segments.length > 1 ? (segments.at(-1) ?? first) : first;
		return new ConstraintViolation(kind, {
			message: text,
			path: [kind === "check" ? columnFromConstraintName(column, table) : column],
		});
	}

	let named = NAMED_CONSTRAINT.exec(message);
	if (named !== null) {
		let kind = kindOf(named[1] ?? "");
		return new ConstraintViolation(kind, {
			message: CONSTRAINT_MESSAGES[kind],
			path: [columnFromConstraintName(named[2] ?? "", table)],
		});
	}

	return null;
}

/**
 * Maps what a write's statement raised into the `ValidationError` a write answers, or `null`
 * for a failure that is not the caller's to handle, which the write rethrows.
 *
 * A table hook's `DataTableValidationError` keeps its issues; a constraint violation, raised as
 * `DataTableConstraintError` or carried in a database error's cause, is a `ConstraintViolation`
 * at the column the constraint covers.
 *
 * @param error What the statement threw.
 * @param table The model's table name, stripped from constraint names.
 */
export function fromWriteError(error: unknown, table: string): ValidationError | null {
	if (error instanceof DataTableValidationError) return toValidationError(error.issues);

	for (let message of messages(error)) {
		let violation = constraintViolation(message, table);
		if (violation !== null) return violation;
	}

	if (error instanceof DataTableConstraintError) {
		return new ValidationError([{ message: error.message }]);
	}

	return null;
}
