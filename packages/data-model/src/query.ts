/**
 * The wrapper that makes a model's scopes callable on a data-table `Query`. A proxy keeps the
 * real query as its target, so `instanceof Query` and `db.exec(query)` hold through it, and
 * every builder call answers the result wrapped again; terminals decode meta into the rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { inList, Query } from "remix/data-table";

import type { ModelConfig, Row } from "./config.js";
import type { MetaFilter } from "./meta.js";

import { attachMeta, resolveMetaFilters } from "./meta.js";

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

/** Narrows the target to the owners the pending `whereMeta` filters match. */
async function applyMetaFilters(target: object, state: QueryState): Promise<object> {
	if (state.metaFilters.length === 0) return target;
	let owners = await resolveMetaFilters(state.db, state.config, state.metaFilters);
	let [ownerKey] = state.config.primaryKey;
	let column = state.structural ? ownerKey : `${state.config.tableName}.${ownerKey}`;
	return (target as { where(input: unknown): object }).where(inList(column ?? "id", owners));
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
					let prepared = await applyMetaFilters(object, state);
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
