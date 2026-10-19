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
	CheckedDefinition,
	ContextHost,
	GeneratedKey,
	KeyGenerator,
	ModelContext,
	ModelContextInit,
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
 * The signature of `createModel`, with the context its callbacks receive and its methods read
 * as `this.context` fixed to `Context`.
 *
 * @template Context The model context, `ModelContext` unless `withContext` names another.
 */
export interface CreateModel<Context extends ModelContext> {
	/**
	 * Defines a model over a data-table table. Its types come from `table` and `options` alone,
	 * so a model created inline in `createModels({ … })` types as one declared on its own.
	 *
	 * @param table The table the model reads and writes.
	 * @param options Constraints, scopes, methods, callbacks and meta fields.
	 */
	<
		T extends AnyTable,
		Methods extends object,
		const Constraints extends Partial<TableRow<T>> = {},
		Scopes extends Record<string, Scope<SingleTableColumn<T>>> = {},
		Fields extends FieldMap = {},
		const Optional extends keyof TableRow<T> & string = never,
		const Inheritance extends keyof TableRow<T> & string = never,
		Generate extends KeyGenerator<T> = never,
	>(
		table: T,
		options?: ModelOptions<
			Shape<
				T,
				Constraints,
				Scopes,
				Methods,
				Fields,
				Optional | GeneratedKey<T, Generate>,
				Inheritance,
				Context
			>,
			Constraints,
			Scopes,
			Methods,
			Fields,
			Optional,
			Inheritance,
			Generate
		>,
	): NoInfer<
		CheckedDefinition<
			Shape<
				T,
				Constraints,
				Scopes,
				Methods,
				Fields,
				Optional | GeneratedKey<T, Generate>,
				Inheritance,
				Context
			>,
			Methods
		>
	>;
}

/**
 * Defines a model over a data-table table. Its rows are the plain objects data-table returns,
 * with constrained columns narrowed and declared meta decoded under `meta`; its writes answer
 * `Result`s and run the callbacks; bind it, or register it, to use it.
 *
 * @example
 * export const Users = createModel(users, {
 * 	generateId: generateUUID,
 * 	scopes: { active: (query) => query.where({ deleted_at: null }) },
 * 	methods: { findByEmail(email: string) { return this.active().where({ email }).first(); } },
 * });
 */
export const createModel: CreateModel<ModelContext> = (table: AnyTable, options?: object) =>
	define(resolveConfig(table, (options ?? {}) as RawOptions)) as never;

/**
 * A `createModel` whose models type their context as `Context`, for an app binding several
 * registries. `Context` is an interface extending `ModelContext`, which resolves its `models`
 * lazily, so each registry's models read `this.context.models` as that registry.
 *
 * @example export const { createModel } = withContext<FeedContext>();
 */
export function withContext<Context extends ModelContext>(): {
	createModel: CreateModel<Context>;
} {
	return { createModel: createModel as CreateModel<never> as CreateModel<Context> };
}
