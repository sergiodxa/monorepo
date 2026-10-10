/**
 * The wrapper that makes a model's scopes callable on a data-table `Query`. A proxy keeps the
 * real query as its target, so `instanceof Query` and `db.exec(query)` hold through it, and
 * every builder call answers the result wrapped again; terminals decode meta into the rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, Database, Predicate } from "remix/data-table";

import { getTableColumns, inList, Query } from "remix/data-table";

import type { LooseQuery, ModelConfig, Row } from "./config.js";
import type { MetaFilter } from "./meta.js";

import { queryOf } from "./config.js";
import { attachMeta, filterTexts, resolveMetaFilters } from "./meta.js";

/** What a wrapped query carries beside the query itself. */
export interface QueryState {
	config: ModelConfig;
	/** The database meta and `whereMeta` read from, the one the query is bound to. */
	db: Database;
	/** Whether the target came through `from()`, so any object with `all()` counts as a query. */
	structural: boolean;
	/** The meta keys terminals load; every declared key when `undefined`. */
	metaKeys: readonly string[] | undefined;
	metaFilters: readonly MetaFilter[];
	/** Whether `select()` projected the rows, which leaves nothing to attach meta to. */
	projected: boolean;
}

/** Every query this module wrapped, so a scope answering its own input is not wrapped twice. */
const WRAPPED = new WeakSet<object>();

/** Whether a value is already a wrapped query. */
function isWrapped(value: object): boolean {
	return WRAPPED.has(value);
}

/** Terminals whose rows carry meta. */
const ROW_TERMINALS = new Set(["all", "first", "find"]);

/**
 * Terminals a `whereMeta` join can serve. `find` adds an unqualified key the join would make
 * ambiguous, and a bulk write cannot carry a join, so both resolve owners first.
 */
const JOINABLE_TERMINALS = new Set(["all", "first", "count", "exists"]);

/** Terminals that only need `whereMeta` resolved first. */
const PLAIN_TERMINALS = new Set(["count", "exists", "update", "delete"]);

/** A query method, as the proxy forwards it. */
type Method = (...args: unknown[]) => unknown;

/** Whether a builder call answered another query, which is what gets wrapped again. */
function isQuery(value: unknown, structural: boolean): value is object {
	if (value instanceof Query) return true;
	if (!structural || typeof value !== "object" || value === null || value instanceof Promise) {
		return false;
	}
	return typeof (value as { all?: unknown }).all === "function";
}

/**
 * data-table keeps a query's state behind a symbol it does not export; it is found once, by
 * description, on the class that defines it.
 */
const QUERY_SNAPSHOT = Object.getOwnPropertySymbols(Query.prototype).find(
	(symbol) => symbol.description === "querySnapshot",
);

/** The part of a data-table query's state a join rebuild reads. */
interface QueryStateSnapshot {
	select: "*" | Array<{ column: string; alias: string }>;
	distinct: boolean;
	joins: Array<{ type: string; table: AnyTable; on: Predicate }>;
	where: Predicate[];
	groupBy: string[];
	having: Predicate[];
	orderBy: Array<{ column: string; direction: "asc" | "desc" }>;
	limit?: number;
	offset?: number;
	with: Record<string, unknown>;
}

/** Qualifies the model's own columns with its table name, leaving every other name as it is. */
function qualifier(config: ModelConfig): (column: string) => string {
	let columns = new Set(Object.keys(getTableColumns(config.table)));
	return (column) =>
		column.includes(".") || !columns.has(column) ? column : `${config.tableName}.${column}`;
}

/** Qualifies every column a predicate names, so it stays unambiguous once another table joins. */
function qualifyPredicate(predicate: Predicate, qualify: (column: string) => string): Predicate {
	if (predicate.type === "logical") {
		return {
			...predicate,
			predicates: predicate.predicates.map((p) => qualifyPredicate(p, qualify)),
		};
	}
	if (predicate.type === "comparison" && predicate.valueType === "column") {
		return { ...predicate, column: qualify(predicate.column), value: qualify(predicate.value) };
	}
	return { ...predicate, column: qualify(predicate.column) } as Predicate;
}

/**
 * Rebuilds a model query with the meta table joined on one filter, which keeps the filter in
 * the database: the owner's columns are selected explicitly and grouped by its key, so a row
 * matching several meta rows comes back once and `count()` counts owners.
 */
function joinFilter(
	target: object,
	state: QueryState,
	filter: MetaFilter,
	texts: string[],
): object {
	let { config } = state;
	let meta = config.metaTable;
	let [ownerKey] = config.primaryKey;
	let snapshot = (target as Record<symbol, () => { state: QueryStateSnapshot }>)[
		QUERY_SNAPSHOT as symbol
	]?.call(target);
	if (meta === undefined || ownerKey === undefined || snapshot === undefined) return target;

	let qualify = qualifier(config);
	let s = snapshot.state;
	let query: LooseQuery = queryOf(state.db, config.table);

	for (let join of s.joins) query = query.join(join.table, join.on, join.type);
	query = query.join(meta.table, {
		type: "logical",
		operator: "and",
		predicates: [
			{
				type: "comparison",
				operator: "eq",
				column: `${meta.tableName}.${meta.foreignKey}`,
				value: `${config.tableName}.${ownerKey}`,
				valueType: "column",
			},
			{
				type: "comparison",
				operator: "eq",
				column: `${meta.tableName}.${meta.key}`,
				value: filter.key,
				valueType: "value",
			},
			{
				type: "comparison",
				operator: "in",
				column: `${meta.tableName}.${meta.value}`,
				value: texts,
				valueType: "value",
			},
		],
	});

	for (let predicate of s.where) query = query.where(qualifyPredicate(predicate, qualify));
	query = query.groupBy(...s.groupBy.map(qualify), `${config.tableName}.${ownerKey}`);
	for (let predicate of s.having) query = query.having(qualifyPredicate(predicate, qualify));
	for (let clause of s.orderBy) query = query.orderBy(qualify(clause.column), clause.direction);
	if (s.limit !== undefined) query = query.limit(s.limit);
	if (s.offset !== undefined) query = query.offset(s.offset);
	if (s.distinct) query = query.distinct();
	if (Object.keys(s.with).length > 0) query = query.with(s.with);

	let selection =
		s.select === "*"
			? Object.keys(getTableColumns(config.table)).map((column) => ({ column, alias: column }))
			: s.select;
	return query.select(
		Object.fromEntries(selection.map((field) => [field.alias, qualify(field.column)])),
	);
}

/**
 * Narrows the target to the owners the pending `whereMeta` filters match. A read joins the
 * meta table on the first filter, so a broad key such as a locale stays one statement; every
 * further filter, and every bulk write, resolves its owners first and filters by their keys.
 */
async function applyMetaFilters(
	target: object,
	state: QueryState,
	joinable: boolean,
): Promise<object> {
	if (state.metaFilters.length === 0) return target;

	let [first, ...rest] = state.metaFilters;
	let prepared = target;
	let pending = state.metaFilters;

	if (
		joinable &&
		first !== undefined &&
		!state.structural &&
		state.config.metaTable !== undefined
	) {
		let texts = filterTexts(state.config, first);
		if (texts.length > 0) {
			prepared = joinFilter(target, state, first, texts);
			pending = rest;
		}
	}

	if (pending.length === 0) return prepared;

	let owners = await resolveMetaFilters(state.db, state.config, pending);
	let [ownerKey] = state.config.primaryKey;
	let column = state.structural ? ownerKey : `${state.config.tableName}.${ownerKey}`;
	return (prepared as { where(input: unknown): object }).where(inList(column ?? "id", owners));
}

/** Attaches meta to a terminal's rows, when the model declares fields and the rows are whole. */
async function decorate(result: unknown, state: QueryState): Promise<unknown> {
	let fields = Object.keys(state.config.fields);
	if (fields.length === 0 || state.projected || result === null || result === undefined) {
		return result;
	}

	let keys = state.metaKeys ?? fields;
	if (Array.isArray(result)) return attachMeta(state.db, state.config, result as Row[], keys);

	let [row] = await attachMeta(state.db, state.config, [result as Row], keys);
	return row;
}

/**
 * Wraps a query so the model's scopes, `withMeta` and `whereMeta` chain on it.
 *
 * @param target A data-table `Query`, or a structural query given to `from()`.
 * @param state The model and the meta options the query carries.
 * @returns The wrapped query, which is still `instanceof Query` for a data-table target.
 */
export function wrapQuery(target: object, state: QueryState): object {
	let proxy: object = new Proxy(target, {
		get(object, property) {
			if (typeof property === "symbol") {
				let value: unknown = Reflect.get(object, property, object);
				return typeof value === "function" ? (value as Method).bind(object) : value;
			}

			let scope = state.config.scopes[property];
			if (scope !== undefined) {
				return (...args: unknown[]) => {
					let result = scope(proxy, ...args);
					return isQuery(result, true) && !isWrapped(result) ? wrapQuery(result, state) : result;
				};
			}

			if (property === "withMeta") {
				return (keys: readonly string[]) => wrapQuery(object, { ...state, metaKeys: [...keys] });
			}

			if (property === "whereMeta") {
				return (key: string, value: unknown) =>
					wrapQuery(object, {
						...state,
						metaFilters: [
							...state.metaFilters,
							{ key, values: Array.isArray(value) ? value : [value] },
						],
					});
			}

			if (ROW_TERMINALS.has(property) || PLAIN_TERMINALS.has(property)) {
				return async (...args: unknown[]) => {
					let joinable = JOINABLE_TERMINALS.has(property);
					let prepared = await applyMetaFilters(object, state, joinable);
					let method = Reflect.get(prepared, property, prepared) as Method;
					let result = await method.apply(prepared, args);
					return ROW_TERMINALS.has(property) ? decorate(result, state) : result;
				};
			}

			let value: unknown = Reflect.get(object, property, object);
			if (typeof value !== "function") return value;

			let projected = state.projected || property === "select";
			return (...args: unknown[]) => {
				let result = (value as Method).apply(object, args);
				return isQuery(result, state.structural)
					? wrapQuery(result, { ...state, projected })
					: result;
			};
		},
	});

	WRAPPED.add(proxy);
	return proxy;
}
