/**
 * A model's options resolved once, at `createModel` or `extend`, into the runtime record every
 * bound model reads: its table metadata, scopes, method factories, stacked callbacks and meta
 * storage. Names that would shadow a query or model member are refused here, before any binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, Database } from "remix/data-table";

import { getTableName, getTablePrimaryKey } from "remix/data-table";

import type { FieldMap } from "./fields.js";
import type { Callbacks, MetaTableOptions } from "./types.js";

/** A plain row, as data-table returns it. */
export type Row = Record<string, unknown>;

/**
 * The data-table query methods the runtime calls, typed loosely: models are built over any
 * table, so the precise column types live in the public types, not here.
 */
export interface LooseQuery {
	where(input: unknown): LooseQuery;
	select(...columns: string[]): LooseQuery;
	distinct(value?: boolean): LooseQuery;
	all(): Promise<Row[]>;
	first(): Promise<Row | null>;
	update(changes: Row, options?: { returning?: "*" | string[] }): Promise<{ rows?: Row[] }>;
	delete(options?: { returning?: "*" | string[] }): Promise<unknown>;
	insertMany(rows: Row[], options?: { returning?: "*" | string[] }): Promise<{ rows?: Row[] }>;
	upsert(
		values: Row,
		options?: { returning?: "*" | string[]; conflictTarget?: string[] },
	): Promise<{ row?: Row | null }>;
}

/** Starts a bound query over any table. */
export function queryOf(db: Database, table: AnyTable): LooseQuery {
	return db.query(table as never) as unknown as LooseQuery;
}

/** A scope as the runtime calls it. */
export type RuntimeScope = (query: unknown, ...args: unknown[]) => unknown;

/** Builds a model's custom methods from the bound model. */
export type MethodFactory = (model: never) => Record<string, unknown>;

/** Where a model's meta rows live, with every default filled in. */
export interface ResolvedMetaTable {
	table: AnyTable;
	tableName: string;
	foreignKey: string;
	key: string;
	value: string;
	latest: readonly string[];
	primaryKey: string;
	generateId: (() => unknown) | undefined;
}

/** A model's options, resolved for the runtime. */
export interface ModelConfig {
	/** The table name, plus the discriminator value for a sub-model. */
	name: string;
	table: AnyTable;
	tableName: string;
	primaryKey: readonly string[];
	constraints: Row;
	inheritance: string | undefined;
	scopes: Record<string, RuntimeScope>;
	/** Base factories first, so a sub-model's methods see the base's. */
	methods: MethodFactory[];
	/** Base callbacks first, which is the order they run in. */
	// oxlint-disable-next-line typescript/no-explicit-any -- callbacks are typed per model shape
	callbacks: Callbacks<any>[];
	metaTable: ResolvedMetaTable | undefined;
	fields: FieldMap;
}

/** The options `createModel` and `extend` resolve, as the runtime reads them. */
export interface RawOptions {
	constraints?: Row;
	inheritance?: string;
	scopes?: Record<string, RuntimeScope>;
	methods?: MethodFactory;
	// oxlint-disable-next-line typescript/no-explicit-any -- callbacks are typed per model shape
	callbacks?: Callbacks<any>;
	metaTable?: MetaTableOptions;
	meta?: FieldMap;
}

/**
 * Members of a model query and of a bound model, which a scope or a meta-less name must not
 * shadow, since every call site would silently reach the scope instead.
 */
const RESERVED_NAMES = new Set([
	"where",
	"having",
	"orderBy",
	"groupBy",
	"limit",
	"offset",
	"distinct",
	"with",
	"select",
	"join",
	"leftJoin",
	"rightJoin",
	"withMeta",
	"whereMeta",
	"all",
	"first",
	"find",
	"count",
	"exists",
	"insert",
	"insertMany",
	"update",
	"delete",
	"upsert",
	"query",
	"from",
	"findBy",
	"create",
	"transaction",
	"load",
	"then",
	"catch",
	"finally",
]);

/** Resolves a meta table's defaults, reading its primary key off the table. */
function resolveMetaTable(options: MetaTableOptions): ResolvedMetaTable {
	let primaryKey = getTablePrimaryKey(options.table);
	let [column] = primaryKey;
	if (primaryKey.length !== 1 || column === undefined) {
		throw new TypeError("A meta table needs a single-column primary key");
	}
	return {
		table: options.table,
		tableName: getTableName(options.table),
		foreignKey: options.foreignKey,
		key: options.key ?? "key",
		value: options.value ?? "value",
		latest: options.latest ?? ["updated_at", "id"],
		primaryKey: column,
		generateId: options.generateId,
	};
}

/** Refuses scope names that shadow a member, which would make the member unreachable. */
function checkScopeNames(scopes: Record<string, RuntimeScope>, existing: Record<string, unknown>) {
	for (let name of Object.keys(scopes)) {
		if (RESERVED_NAMES.has(name)) {
			throw new TypeError(`A scope cannot be named "${name}", which a query already defines`);
		}
		if (name in existing) {
			throw new TypeError(`The scope "${name}" is already defined by the base model`);
		}
	}
}

/**
 * Resolves `createModel`'s options.
 *
 * @throws {TypeError} When a scope shadows a member, or meta fields lack a meta table.
 */
export function resolveConfig(table: AnyTable, options: RawOptions): ModelConfig {
	let scopes = options.scopes ?? {};
	checkScopeNames(scopes, {});

	let primaryKey = getTablePrimaryKey(table);
	let fields = options.meta ?? {};
	let metaTable = options.metaTable === undefined ? undefined : resolveMetaTable(options.metaTable);

	if (Object.keys(fields).length > 0 && metaTable === undefined) {
		throw new TypeError("Meta fields need a `metaTable` to be stored in");
	}
	if (metaTable !== undefined && primaryKey.length !== 1) {
		throw new TypeError("A model with a meta table needs a single-column primary key");
	}

	return {
		name: getTableName(table),
		table,
		tableName: getTableName(table),
		primaryKey,
		constraints: { ...options.constraints },
		inheritance: options.inheritance,
		scopes,
		methods: options.methods === undefined ? [] : [options.methods],
		callbacks: options.callbacks === undefined ? [] : [options.callbacks],
		metaTable,
		fields,
	};
}

/**
 * Resolves `extend`'s options on top of the base's: the discriminator joins the constraints,
 * and scopes, methods, callbacks and fields stack after the base's.
 *
 * @throws {TypeError} When the base names no discriminator, or a scope repeats a base name.
 */
export function extendConfig(base: ModelConfig, value: unknown, options: RawOptions): ModelConfig {
	if (base.inheritance === undefined) {
		throw new TypeError(`${base.name} names no \`inheritance\` column to extend on`);
	}

	let scopes = options.scopes ?? {};
	checkScopeNames(scopes, base.scopes);

	let fields = { ...base.fields, ...options.meta };
	if (Object.keys(fields).length > 0 && base.metaTable === undefined) {
		throw new TypeError("Meta fields need a `metaTable` on the base model");
	}

	return {
		...base,
		name: `${base.tableName}.${String(value)}`,
		constraints: { ...base.constraints, [base.inheritance]: value },
		inheritance: undefined,
		scopes: { ...base.scopes, ...scopes },
		methods: options.methods === undefined ? base.methods : [...base.methods, options.methods],
		callbacks:
			options.callbacks === undefined ? base.callbacks : [...base.callbacks, options.callbacks],
		fields,
	};
}

/** The `WHERE` object a primary-key input selects, for a single or a composite key. */
export function keyWhere(config: ModelConfig, key: unknown): Row {
	let [column] = config.primaryKey;
	if (config.primaryKey.length === 1 && column !== undefined) return { [column]: key };

	let object = (key ?? {}) as Row;
	let where: Row = {};
	for (let name of config.primaryKey) where[name] = object[name];
	return where;
}
