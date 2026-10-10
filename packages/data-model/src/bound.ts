/**
 * Builds the bound model a definition becomes in one binding: its queries, scopes, writes and
 * custom methods, all reading the binding's database. Methods are bound with the model as
 * `this`, so they compose its scopes and each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelConfig, Row } from "./config.js";
import type { Session } from "./session.js";
import type { AnyBoundModels } from "./types.js";

import { keyWhere, scopeQuery } from "./config.js";
import { wrapQuery } from "./query.js";
import { runUnitOfWork } from "./session.js";
import { createRow, deleteRow, updateRow, upsertRow } from "./writes.js";

/** A bound model, as the runtime builds it. */
type RuntimeModel = Record<string, unknown> & {
	query(): { where(input: unknown): { first(): Promise<unknown> } };
};

/**
 * Binds a model's config to a binding.
 *
 * @param config The model's resolved options.
 * @param session The binding every member reads and writes through.
 */
export function bindModel(config: ModelConfig, session: Session): RuntimeModel {
	let state = (structural: boolean) => ({
		config,
		db: session.db,
		structural,
		metaKeys: undefined,
		metaFilters: [],
		projected: false,
	});

	let model: RuntimeModel = {
		query: () =>
			wrapQuery(scopeQuery(session.db.query(config.table as never), config), state(false)) as never,
		unscoped: () =>
			wrapQuery(scopeQuery(session.db.query(config.table as never), config, true), state(false)),
		from: (query: object) => wrapQuery(scopeQuery(query, config), state(true)),
		withMeta: (keys: readonly string[]) =>
			(model.query() as unknown as { withMeta(keys: readonly string[]): unknown }).withMeta(keys),
		whereMeta: (key: string, value: unknown) =>
			(model.query() as unknown as { whereMeta(key: string, value: unknown): unknown }).whereMeta(
				key,
				value,
			),
		find: (key: unknown) => model.query().where(keyWhere(config, key)).first(),
		findBy: (where: unknown) => model.query().where(where).first(),
		create: (values: Row) => createRow(session, config, values),
		update: (key: unknown, values: Row) => updateRow(session, config, key, values),
		upsert: (values: Row, options?: { conflictTarget?: string[] }) =>
			upsertRow(session, config, values, options?.conflictTarget),
		delete: (key: unknown) => deleteRow(session, config, key),
		transaction: (fn: (models: AnyBoundModels) => Promise<unknown>) => runUnitOfWork(session, fn),
		load: async () => model,
	};

	for (let name of Object.keys(config.scopes)) {
		model[name] = (...args: unknown[]) =>
			(model.query() as unknown as Record<string, (...args: unknown[]) => unknown>)[name]?.(
				...args,
			);
	}

	for (let methods of config.methods) {
		for (let [name, method] of Object.entries(methods)) model[name] = method.bind(model);
	}

	return model;
}
