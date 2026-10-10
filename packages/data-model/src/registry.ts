/**
 * `createModels`: the registry an app binds per invocation, so a handler, a job or a callback
 * reaches every model through one object bound to the right database. Entries bind on first
 * access, and an entry may be an import, so an invocation evaluates only the models it uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Session } from "./session.js";
import type {
	AnyBoundModels,
	BindOptions,
	BoundModels,
	ContextHost,
	ModelContextInit,
	RegistryEntries,
} from "./types.js";

import { buildModels, createSession } from "./session.js";

/**
 * A registry of models, keyed by the lowercase plural name each is bound under.
 *
 * @template Entries The registry's models and lazy imports.
 */
export interface ModelRegistry<Entries extends RegistryEntries> {
	readonly entries: Entries;
	/**
	 * Binds every entry to a database and a host, for a script, a seed or a test.
	 *
	 * @param context The model context's members besides `get`, `require` and `models`.
	 * @param host What callbacks' `get` and `require` read through to.
	 * @param options Whether the database has real transactions.
	 */
	bind(context: ModelContextInit, host?: ContextHost, options?: BindOptions): BoundModels<Entries>;
}

/**
 * Creates a registry. An entry is a model, or a function importing a module that
 * default-exports one, which loads on its first call in each invocation.
 *
 * @param entries The models, keyed by the name they are bound under.
 * @example
 * export const models = createModels({ users: Users, articles: () => import("./articles.js") });
 */
export function createModels<const Entries extends RegistryEntries>(
	entries: Entries,
): ModelRegistry<Entries> {
	return {
		entries,
		bind(context, host, options) {
			return createSession({ init: context, host, options, entries }).models as never;
		},
	};
}

/**
 * Binds a registry whose model context is computed on the first model access, which is how a
 * middleware publishes `ctx.models` before anything has read the context it is built from.
 *
 * @param registry The registry to bind.
 * @param context Builds the model context, called once, on the first access.
 * @param host What callbacks' `get` and `require` read through to.
 * @param options Whether the database has real transactions.
 */
export function bindLazily<Entries extends RegistryEntries>(
	registry: ModelRegistry<Entries>,
	context: () => ModelContextInit,
	host: ContextHost,
	options: BindOptions | undefined,
): BoundModels<Entries> {
	let session: Session | undefined;
	let models: AnyBoundModels = buildModels(registry.entries, () => {
		session ??= createSession({
			init: context(),
			host,
			options,
			entries: registry.entries,
			models,
		});
		return session;
	});
	return models as never;
}
