/**
 * Reading, writing and filtering a model's meta fields over its key/value companion table.
 * Every statement binds few enough parameters for D1's per-query limit, and writes insert
 * before they prune, so a failure between the two leaves every key reading its latest value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Database } from "remix/data-table";

import { inList, notInList } from "remix/data-table";

import type { ModelConfig, ResolvedMetaTable, Row } from "./config.js";

import { queryOf } from "./config.js";

/**
 * Bound parameters one statement may use: D1 allows 100 per query, and a little room stays for
 * the predicates around the list.
 */
const MAX_PARAMETERS = 90;

/** A `whereMeta` call waiting to be resolved when the query runs. */
export interface MetaFilter {
	key: string;
	values: readonly unknown[];
}

/** Splits a list into runs of at most `size`, so each run fits one statement's parameters. */
function chunk<Value>(values: readonly Value[], size: number): Value[][] {
	let runs: Value[][] = [];
	let step = Math.max(1, size);
	for (let start = 0; start < values.length; start += step) {
		runs.push(values.slice(start, start + step));
	}
	return runs;
}

/** Orders two column values the way SQLite does: `null` first, numbers numerically, then text. */
function compareValues(left: unknown, right: unknown): number {
	if (left === right) return 0;
	if (left === null || left === undefined) return -1;
	if (right === null || right === undefined) return 1;
	if (typeof left === "number" && typeof right === "number") return left - right;
	return (left as string | number) < (right as string | number) ? -1 : 1;
}

/** Orders meta rows oldest first by the `latest` columns, so the last row of a key wins. */
function compareRows(meta: ResolvedMetaTable): (left: Row, right: Row) => number {
	return (left, right) => {
		for (let column of meta.latest) {
			let order = compareValues(left[column], right[column]);
			if (order !== 0) return order;
		}
		return 0;
	};
}

/**
 * Decodes one owner's meta rows into the `meta` object its row carries. A list field reads
 * every decodable row in order; any other field reads its latest row, and a value the codec
 * rejects reads as missing, then as the field's default when it declares one.
 */
function decode(config: ModelConfig, rows: Row[], keys: readonly string[]): Row {
	let meta = config.metaTable;
	let decoded: Row = {};
	if (meta === undefined) return decoded;

	for (let key of keys) {
		let field = config.fields[key];
		if (field === undefined) continue;

		let texts = rows.filter((row) => row[meta.key] === key).map((row) => String(row[meta.value]));
		let value: unknown;

		if (field.isList) {
			let items = texts.map((text) => field.decodeItem(text)).filter((item) => item !== undefined);
			value = items.length > 0 ? items : undefined;
		} else {
			let latest = texts.at(-1);
			value = latest === undefined ? undefined : field.decodeItem(latest);
		}

		decoded[key] = value === undefined && field.hasDefault ? field.defaultValue : value;
	}

	return decoded;
}

/**
 * Attaches decoded `meta` to rows, with one query per run of owners. Rows keep their order,
 * and rows without the owner's primary key, such as a projection, pass through unchanged.
 *
 * @param db The database to read the meta table from.
 * @param config The model the rows belong to.
 * @param rows Rows of the model's table.
 * @param keys The meta keys to load; every declared key when omitted.
 */
export async function attachMeta(
	db: Database,
	config: ModelConfig,
	rows: Row[],
	keys: readonly string[] = Object.keys(config.fields),
): Promise<Row[]> {
	let meta = config.metaTable;
	let [ownerKey] = config.primaryKey;
	if (meta === undefined || ownerKey === undefined || rows.length === 0) return rows;

	let owners = [...new Set(rows.map((row) => row[ownerKey]).filter((id) => id !== undefined))];
	let byOwner = new Map<unknown, Row[]>();

	if (keys.length > 0) {
		for (let run of chunk(owners, MAX_PARAMETERS - keys.length)) {
			let found = await queryOf(db, meta.table)
				.where(inList(meta.foreignKey, run))
				.where(inList(meta.key, [...keys]))
				.all();
			for (let row of found) {
				let list = byOwner.get(row[meta.foreignKey]) ?? [];
				list.push(row);
				byOwner.set(row[meta.foreignKey], list);
			}
		}
	}

	let order = compareRows(meta);
	return rows.map((row) => {
		if (!(ownerKey in row)) return row;
		let owned = (byOwner.get(row[ownerKey]) ?? []).sort(order);
		return { ...row, meta: decode(config, owned, keys) };
	});
}

/**
 * Checks a write's `meta` against the declared fields: every value must encode, and a required
 * field must be present on create and never set to `null`. Keys the model does not declare are
 * left alone.
 *
 * @param config The model being written.
 * @param meta The write's `meta`, or `undefined` when it names none.
 * @param operation Whether the write creates the row, which is when required fields must appear.
 * @returns Issues with paths such as `["meta", "title"]`.
 */
export function validateMeta(
	config: ModelConfig,
	meta: Row | undefined,
	operation: "create" | "update",
): StandardSchemaV1.Issue[] {
	let issues: StandardSchemaV1.Issue[] = [];
	let values = meta ?? {};

	for (let [key, field] of Object.entries(config.fields)) {
		let value = values[key];
		let missing = value === undefined || value === null;

		if (field.isRequired && missing && (operation === "create" || value === null)) {
			issues.push({ message: "Required", path: ["meta", key] });
			continue;
		}
		if (missing) continue;

		let encoded = field.encode(value);
		if (!encoded.ok) issues.push({ message: encoded.message, path: ["meta", key] });
	}

	return issues;
}

/** The declared keys a write's `meta` names, `null` values included. */
export function namedKeys(config: ModelConfig, meta: Row | undefined): string[] {
	if (meta === undefined) return [];
	return Object.keys(meta).filter((key) => key in config.fields && meta[key] !== undefined);
}

/**
 * Writes the keys a `meta` names for one owner: inserts the new rows, then deletes the older
 * rows of those keys, which removes a key set to `null`. Both statements stay within D1's
 * parameter limit, splitting when a list holds many items.
 *
 * @param db The database, or the transaction the write runs in.
 * @param config The model being written.
 * @param owner The owner row's primary key.
 * @param meta The validated `meta` of the write.
 */
export async function writeMeta(
	db: Database,
	config: ModelConfig,
	owner: unknown,
	meta: Row | undefined,
): Promise<void> {
	let table = config.metaTable;
	let keys = namedKeys(config, meta);
	if (table === undefined || meta === undefined || keys.length === 0) return;

	let rows: Row[] = [];
	for (let key of keys) {
		let value = meta[key];
		let field = config.fields[key];
		if (value === null || field === undefined) continue;

		let encoded = field.encode(value);
		if (!encoded.ok) throw new TypeError(`meta.${key}: ${encoded.message}`);

		for (let text of encoded.texts) {
			let row: Row = { [table.foreignKey]: owner, [table.key]: key, [table.value]: text };
			if (table.generateId !== undefined) row[table.primaryKey] = table.generateId();
			rows.push(row);
		}
	}

	let inserted: unknown[] = [];
	let columnsPerRow = Object.keys(rows[0] ?? {}).length + 2;
	for (let run of chunk(rows, Math.floor(MAX_PARAMETERS / columnsPerRow))) {
		if (table.generateId !== undefined) {
			await queryOf(db, table.table).insertMany(run);
			inserted.push(...run.map((row) => row[table.primaryKey]));
		} else {
			let result = await queryOf(db, table.table).insertMany(run, {
				returning: [table.primaryKey],
			});
			inserted.push(...(result.rows ?? []).map((row) => row[table.primaryKey]));
		}
	}

	await pruneMeta(db, table, owner, keys, inserted);
}

/**
 * Deletes an owner's rows under `keys` other than the ones just inserted. When the list of kept
 * rows would overflow one statement, the stale rows are read first and deleted in runs.
 */
async function pruneMeta(
	db: Database,
	table: ResolvedMetaTable,
	owner: unknown,
	keys: readonly string[],
	kept: readonly unknown[],
): Promise<void> {
	let scope = () =>
		queryOf(db, table.table)
			.where({ [table.foreignKey]: owner })
			.where(inList(table.key, [...keys]));

	if (kept.length + keys.length < MAX_PARAMETERS) {
		let query = kept.length === 0 ? scope() : scope().where(notInList(table.primaryKey, [...kept]));
		await query.delete();
		return;
	}

	let keep = new Set(kept);
	let existing = await scope().select(table.primaryKey).all();
	let stale = existing.map((row) => row[table.primaryKey]).filter((id) => !keep.has(id));
	for (let run of chunk(stale, MAX_PARAMETERS)) {
		await queryOf(db, table.table).where(inList(table.primaryKey, run)).delete();
	}
}

/** Deletes every meta row of an owner, for a delete whose table declares no cascade. */
export async function deleteMeta(db: Database, config: ModelConfig, owner: unknown): Promise<void> {
	let table = config.metaTable;
	if (table === undefined) return;
	await queryOf(db, table.table)
		.where({ [table.foreignKey]: owner })
		.delete();
}

/** The owners in both sets, or all of `next` for the first filter. */
function intersect(
	previous: ReadonlySet<unknown> | undefined,
	next: ReadonlySet<unknown>,
): ReadonlySet<unknown> {
	if (previous === undefined) return next;
	return new Set([...next].filter((id) => previous.has(id)));
}

/**
 * Encodes a filter's values as the texts the meta table stores, an item at a time for a list
 * field. A value the field cannot encode matches nothing, so it is left out.
 */
export function filterTexts(config: ModelConfig, filter: MetaFilter): string[] {
	let field = config.fields[filter.key];
	let texts: string[] = [];
	for (let value of filter.values) {
		let encoded = field?.isList ? field.encode([value]) : field?.encode(value);
		if (encoded?.ok) texts.push(...encoded.texts);
	}
	return texts;
}

/**
 * Resolves `whereMeta` filters into the owners matching all of them, one query per filter.
 * A value its field cannot encode matches nothing.
 *
 * @returns The owners' primary keys.
 */
export async function resolveMetaFilters(
	db: Database,
	config: ModelConfig,
	filters: readonly MetaFilter[],
): Promise<unknown[]> {
	let table = config.metaTable;
	if (table === undefined) return [];

	let matched: ReadonlySet<unknown> | undefined;

	for (let filter of filters) {
		let texts = filterTexts(config, filter);

		let found = new Set<unknown>();
		for (let run of chunk(texts, MAX_PARAMETERS - 1)) {
			let rows = await queryOf(db, table.table)
				.where({ [table.key]: filter.key })
				.where(inList(table.value, run))
				.select(table.foreignKey)
				.distinct()
				.all();
			for (let row of rows) found.add(row[table.foreignKey]);
		}

		matched = intersect(matched, found);
		if (matched.size === 0) break;
	}

	return [...(matched ?? [])];
}
