/**
 * `createModel`: a data-table table plus scopes, custom methods, async callbacks and typed
 * meta fields, returned as an unbound definition. Binding supplies the database and the host
 * context once, so every member runs on the right database without taking it as an argument.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, SingleTableColumn, TableRow } from "remix/data-table";

import type { ModelConfig, RawOptions } from "./config.js";
import type { FieldMap } from "./fields.js";
import type {
	BindOptions,
	ContextHost,
	MethodMap,
	ModelContextInit,
	ModelDefinition,
	ModelOptions,
	Scope,
	Shape,
} from "./types.js";

import { extendConfig, resolveConfig } from "./config.js";
import { CONFIG, createSession } from "./session.js";

/** Wraps a resolved config as a definition, the object `createModel` and `extend` answer. */
function define(config: ModelConfig): unknown {
	return {
		name: config.name,
		table: config.table,
		"~types": undefined,
		[CONFIG]: config,
		bind(context: ModelContextInit, host?: ContextHost, options?: BindOptions) {
			let session = createSession({
				init: context,
				host,
				options,
				entries: { [config.name]: this as never },
			});
			return session.models[config.name];
		},
		extend(value: unknown, options: RawOptions = {}) {
			return define(extendConfig(config, value, options));
		},
	};
}

/**
 * Defines a model over a data-table table. Its rows are the plain objects data-table returns,
 * with constrained columns narrowed and declared meta decoded under `meta`; its writes answer
 * `Result`s and run the callbacks; bind it, or register it, to use it.
 *
 * @param table The table the model reads and writes.
 * @param options Constraints, scopes, methods, callbacks and meta fields.
 * @returns The unbound definition.
 * @example
 * export const Users = createModel(users, {
 * 	scopes: { active: (query) => query.where({ deleted_at: null }) },
 * 	methods: (model) => ({ findByEmail: (email: string) => model.active().where({ email }).first() }),
 * });
 */
export function createModel<
	T extends AnyTable,
	const Constraints extends Partial<TableRow<T>> = {},
	Scopes extends Record<string, Scope<SingleTableColumn<T>>> = {},
	Methods extends MethodMap = {},
	Fields extends FieldMap = {},
	const Optional extends keyof TableRow<T> & string = never,
	const Inheritance extends keyof TableRow<T> & string = never,
>(
	table: T,
	options?: ModelOptions<
		Shape<T, Constraints, Scopes, {}, Fields, Optional, Inheritance>,
		Constraints,
		Scopes,
		Methods,
		Fields,
		Optional,
		Inheritance
	>,
): ModelDefinition<Shape<T, Constraints, Scopes, Methods, Fields, Optional, Inheritance>> {
	return define(resolveConfig(table, (options ?? {}) as RawOptions)) as never;
}
