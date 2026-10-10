/**
 * The four writes a bound model runs callbacks around: create, update, upsert and delete. Each
 * reads the row it affects first, so callbacks see the row before the statement and the event
 * names what changed; failures come back as `Result`s and only the unexpected ones throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";
import { getTableTimestamps } from "remix/data-table";

import type { ModelConfig, Row } from "./config.js";
import type { LooseQuery } from "./config.js";
import type { Commit, Session, WriteOutcome } from "./session.js";
import type { ModelContext, ModelEvent } from "./types.js";

import { keyWhere, queryOf, scopeQuery } from "./config.js";
import { fromWriteError, isCallbackFailure, NotFound, toValidationError } from "./errors.js";
import { attachMeta, deleteMeta, namedKeys, validateMeta, writeMeta } from "./meta.js";
import { modelContext, runWrite } from "./session.js";

/** A write's outcome before it is reported: failed, or succeeded with its events. */
type Outcome = WriteOutcome<Row>;

/** A write that failed, with no events to dispatch. */
function failed(error: Error): Outcome {
	return { result: failure(error), commits: [] };
}

/** Splits a write's values into its columns and its `meta`, dropping constrained columns. */
function split(config: ModelConfig, values: Row): { columns: Row; meta: Row | undefined } {
	let { meta, ...columns } = values;
	for (let column of Object.keys(config.constraints)) delete columns[column];
	return { columns, meta: meta === undefined || meta === null ? undefined : (meta as Row) };
}

/** Reads the row a query selects, with its meta, or `null`. */
async function readRow(
	session: Session,
	config: ModelConfig,
	query: LooseQuery,
): Promise<Row | null> {
	let row = await query.first();
	if (row === null || Object.keys(config.fields).length === 0) return row;
	let [decorated] = await attachMeta(session.db, config, [row]);
	return decorated ?? null;
}

/** Re-reads a row's meta after a write, so the row reported carries every declared key. */
async function withMeta(session: Session, config: ModelConfig, row: Row): Promise<Row> {
	if (Object.keys(config.fields).length === 0) return row;
	let [decorated] = await attachMeta(session.db, config, [row]);
	return decorated ?? row;
}

/** Runs every model `validate` callback, collecting their issues with the meta field issues. */
async function validate(
	config: ModelConfig,
	values: Row,
	meta: Row | undefined,
	operation: "create" | "update",
	ctx: ModelContext,
): Promise<ValidationError | null> {
	let issues: unknown[] = validateMeta(config, meta, operation);
	for (let callbacks of config.callbacks) {
		let result = await callbacks.validate?.({ ...values, meta }, ctx);
		if (isCallbackFailure(result)) issues.push(...result.issues);
	}
	return issues.length > 0 ? toValidationError(issues) : null;
}

/** The before-callback a write runs, by its name on the callback object. */
type BeforeName = "beforeCreate" | "beforeUpdate";

/**
 * Runs the stacked `before*` callbacks, each seeing the previous one's rewrite.
 *
 * @returns The final values, or the failure one of them returned.
 */
async function runBefore(
	config: ModelConfig,
	name: BeforeName,
	values: Row,
	ctx: ModelContext,
	before: Row | null,
): Promise<Row | ValidationError> {
	let current = values;
	for (let callbacks of config.callbacks) {
		let callback = callbacks[name] as
			| ((values: Row, ctx: ModelContext, before: Row | null) => unknown)
			| undefined;
		let result = await callback?.call(callbacks, current, ctx, before);
		if (isCallbackFailure(result)) return toValidationError(result.issues);
		if (result !== undefined && result !== null && typeof result === "object")
			current = result as Row;
	}
	return current;
}

/** The after-callback a write runs, by its name on the callback object. */
type AfterName = "afterCreate" | "afterUpdate" | "afterDelete";

/** Runs the stacked `after*` callbacks, stopping at the first failure. */
async function runAfter(
	config: ModelConfig,
	name: AfterName,
	row: Row,
	ctx: ModelContext,
	before: Row | null,
): Promise<ValidationError | null> {
	for (let callbacks of config.callbacks) {
		let callback = callbacks[name] as
			| ((row: Row, ctx: ModelContext, before: Row | null) => unknown)
			| undefined;
		let result = await callback?.call(callbacks, row, ctx, before);
		if (isCallbackFailure(result)) return toValidationError(result.issues);
	}
	return null;
}

/** One `afterCommit` dispatch per callback set declaring it, in stacking order. */
function commitsFor(config: ModelConfig, event: ModelEvent<Row>): Commit[] {
	return config.callbacks.flatMap((callbacks) => {
		if (callbacks.afterCommit === undefined) return [];
		return [
			async (ctx: ModelContext) => {
				await callbacks.afterCommit?.(event, ctx);
			},
		];
	});
}

/** Whether two column values hold the same data, comparing objects by their JSON. */
function sameValue(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
		return false;
	}
	return JSON.stringify(left) === JSON.stringify(right);
}

/** The columns and meta keys an update altered, meta keys spelled `meta.<key>`. */
function changedBetween(before: Row, after: Row): string[] {
	let changed = Object.keys(after).filter(
		(column) => column !== "meta" && !sameValue(before[column], after[column]),
	);
	let beforeMeta = (before.meta ?? {}) as Row;
	let afterMeta = (after.meta ?? {}) as Row;
	for (let key of new Set([...Object.keys(beforeMeta), ...Object.keys(afterMeta)])) {
		if (!sameValue(beforeMeta[key], afterMeta[key])) changed.push(`meta.${key}`);
	}
	return changed;
}

/** Maps a statement's error into a failed outcome, rethrowing what is not the caller's to handle. */
function statementFailure(error: unknown, table: string): Outcome {
	let mapped = fromWriteError(error, table);
	if (mapped === null) throw error;
	return failed(mapped);
}

/** Prefixes a meta statement's issues with `meta`, since the caller wrote them under it. */
function metaFailure(error: unknown, table: string): Outcome {
	let mapped = fromWriteError(error, table);
	if (mapped === null) throw error;
	mapped.issues = mapped.issues.map((issue: StandardSchemaV1.Issue) => ({
		...issue,
		path: ["meta", ...(issue.path ?? [])],
	}));
	return failed(mapped);
}

/**
 * Inserts a row, writing the model's constraints, then its meta. When the meta statement fails,
 * the owner row is deleted again, so a create on D1 leaves no half-written row.
 */
export function createRow(
	session: Session,
	config: ModelConfig,
	values: Row,
): Promise<Result<Row, Error>> {
	return runWrite(session, (scoped) =>
		insert(
			scoped,
			config,
			values,
			async (columns) =>
				(await scoped.db.create(config.table, columns, { returnRow: true })) as Row,
		),
	);
}

/**
 * The body of a create. `statement` writes the owner row, which is a plain insert for `create`
 * and `INSERT … ON CONFLICT DO UPDATE` for an `upsert` that found no row.
 */
async function insert(
	scoped: Session,
	config: ModelConfig,
	values: Row,
	statement: (columns: Row) => Promise<Row>,
): Promise<Outcome> {
	let ctx = modelContext(scoped);
	let initial = split(config, values);

	let invalid = await validate(config, initial.columns, initial.meta, "create", ctx);
	if (invalid !== null) return failed(invalid);

	let rewritten = await runBefore(
		config,
		"beforeCreate",
		{ ...initial.columns, ...(initial.meta === undefined ? {} : { meta: initial.meta }) },
		ctx,
		null,
	);
	if (!isRow(rewritten)) return failed(rewritten);

	let { columns, meta } = split(config, rewritten);
	let metaIssues = validateMeta(config, meta, "create");
	if (metaIssues.length > 0) return failed(toValidationError(metaIssues));

	let row: Row;
	try {
		row = await statement({ ...columns, ...config.constraints });
	} catch (error) {
		return statementFailure(error, config.tableName);
	}

	let owner = row[config.primaryKey[0] ?? "id"];
	try {
		await writeMeta(scoped.db, config, owner, meta);
	} catch (error) {
		await queryOf(scoped.db, config.table).where(keyWhere(config, owner)).delete();
		return metaFailure(error, config.metaTable?.tableName ?? config.tableName);
	}

	row = await withMeta(scoped, config, row);

	let after = await runAfter(config, "afterCreate", row, ctx, null);
	if (after !== null) return failed(after);

	let changed = [
		...Object.keys(columns),
		...Object.keys(config.constraints),
		...namedKeys(config, meta).map((key) => `meta.${key}`),
	];
	return {
		result: success(row),
		commits: commitsFor(config, { operation: "create", row, before: null, changed }),
	};
}

/** A row's columns alone, as the statement would return them. */
function withoutMeta(row: Row): Row {
	let columns = { ...row };
	delete columns.meta;
	return columns;
}

/** Whether a before-callback chain produced values rather than a failure. */
function isRow(value: Row | ValidationError): value is Row {
	return !(value instanceof Error);
}

/**
 * Updates the row with `key`, which must also satisfy the model's constraints; constrained
 * columns are never changed. An update naming only meta keys leaves the row's columns as they
 * are.
 */
export function updateRow(
	session: Session,
	config: ModelConfig,
	key: unknown,
	values: Row,
): Promise<Result<Row, Error>> {
	return runWrite(session, async (scoped) => {
		let target = () => modelRows(scoped, config).where(keyWhere(config, key));
		let before = await readRow(scoped, config, target());
		if (before === null) return failed(new NotFound(config.name, key));
		return change(scoped, config, target, before, values);
	});
}

/** The model's rows as a write sees them: constrained, with its default scopes applied. */
function modelRows(session: Session, config: ModelConfig): LooseQuery {
	return scopeQuery(queryOf(session.db, config.table), config);
}

/**
 * The columns that mark a row as changed when only its meta was written: the table's declared
 * `updatedAt` column at the database's clock, which is what a column update touches too.
 */
function touch(session: Session, config: ModelConfig): Row {
	let timestamps = getTableTimestamps(config.table);
	return timestamps === null ? {} : { [timestamps.updatedAt]: session.db.now() };
}

/**
 * The body of an update, also used by `upsert` when a row conflicts.
 *
 * @param target Selects the row the statement updates, scoped the way the caller read it.
 */
async function change(
	scoped: Session,
	config: ModelConfig,
	target: () => LooseQuery,
	before: Row,
	values: Row,
): Promise<Outcome> {
	let ctx = modelContext(scoped);
	let initial = split(config, values);
	let key: Row = {};
	for (let column of config.primaryKey) key[column] = before[column];

	let invalid = await validate(config, { ...key, ...initial.columns }, initial.meta, "update", ctx);
	if (invalid !== null) return failed(invalid);

	let rewritten = await runBefore(
		config,
		"beforeUpdate",
		{ ...initial.columns, ...(initial.meta === undefined ? {} : { meta: initial.meta }) },
		ctx,
		before,
	);
	if (!isRow(rewritten)) return failed(rewritten);

	let { columns, meta } = split(config, rewritten);
	let metaIssues = validateMeta(config, meta, "update");
	if (metaIssues.length > 0) return failed(toValidationError(metaIssues));

	if (Object.keys(columns).length === 0 && namedKeys(config, meta).length > 0) {
		columns = touch(scoped, config);
	}

	let row: Row = withoutMeta(before);
	if (Object.keys(columns).length > 0) {
		try {
			let result = await target().update(columns, { returning: "*" });
			let [updated] = result.rows ?? [];
			if (updated === undefined) return failed(new NotFound(config.name, key));
			row = updated;
		} catch (error) {
			return statementFailure(error, config.tableName);
		}
	}

	try {
		await writeMeta(scoped.db, config, row[config.primaryKey[0] ?? "id"], meta);
	} catch (error) {
		return metaFailure(error, config.metaTable?.tableName ?? config.tableName);
	}

	row = await withMeta(scoped, config, row);

	let after = await runAfter(config, "afterUpdate", row, ctx, before);
	if (after !== null) return failed(after);

	let changed = changedBetween(before, row);
	return {
		result: success(row),
		commits: commitsFor(config, { operation: "update", row, before, changed }),
	};
}

/**
 * Inserts a row or updates the one it conflicts with, in one statement. The conflicting row is
 * read first by the conflict target's values, which decides whether the create or the update
 * callbacks run; a conflicting row the model's constraints exclude is refused.
 */
export function upsertRow(
	session: Session,
	config: ModelConfig,
	values: Row,
	conflictTarget: readonly string[] | undefined,
): Promise<Result<Row, Error>> {
	return runWrite(session, async (scoped) => {
		let target = conflictTarget ?? config.primaryKey;
		let input = { ...values, ...config.constraints };
		let present = target.every((column) => input[column] !== undefined);
		let lookup: Row = {};
		for (let column of target) lookup[column] = input[column];

		let before = present
			? await readRow(scoped, config, queryOf(scoped.db, config.table).where(lookup))
			: null;
		if (before === null) {
			return insert(scoped, config, values, async (columns) => {
				let result = await queryOf(scoped.db, config.table).upsert(columns, {
					returning: "*",
					conflictTarget: [...target],
				});
				if (result.row === null || result.row === undefined) {
					throw new TypeError(`upsert() on ${config.tableName} returned no row`);
				}
				return result.row;
			});
		}

		let owned = Object.entries(config.constraints).every(([column, value]) =>
			sameValue(before[column], value),
		);
		if (!owned) {
			return failed(
				toValidationError([
					{ message: "Conflicts with a row this model does not own", path: [target[0] ?? "id"] },
				]),
			);
		}

		let owner = { ...lookup, ...config.constraints };
		return change(
			scoped,
			config,
			() => queryOf(scoped.db, config.table).where(owner),
			before,
			values,
		);
	});
}

/**
 * Deletes the row with `key`, answering it as it read before the statement. A database
 * refusal, such as another table still referencing the row, comes back as a `ValidationError`.
 */
export function deleteRow(
	session: Session,
	config: ModelConfig,
	key: unknown,
): Promise<Result<Row, Error>> {
	return runWrite(session, async (scoped) => {
		let ctx = modelContext(scoped);
		let target = () => modelRows(scoped, config).where(keyWhere(config, key));
		let before = await readRow(scoped, config, target());
		if (before === null) return failed(new NotFound(config.name, key));

		for (let callbacks of config.callbacks) {
			let refusal = await callbacks.beforeDelete?.(before, ctx);
			if (isCallbackFailure(refusal)) return failed(toValidationError(refusal.issues));
		}

		try {
			await target().delete();
		} catch (error) {
			return statementFailure(error, config.tableName);
		}

		await deleteMeta(scoped.db, config, before[config.primaryKey[0] ?? "id"]);

		let after = await runAfter(config, "afterDelete", before, ctx, null);
		if (after !== null) return failed(after);

		return {
			result: success(before),
			commits: commitsFor(config, { operation: "delete", row: before, before, changed: [] }),
		};
	});
}
