/**
 * A binding's runtime: the database, the host context and the unit of work every bound model
 * in it shares. It defines when `afterCommit` events flush, how a write rolls back where the
 * database can, and how a lazily loaded registry entry answers before its module has loaded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import type { ModelConfig } from "./config.js";
import type {
	AnyBoundModels,
	BindOptions,
	ContextHost,
	ModelContext,
	ModelContextInit,
	RegistryEntries,
	RegistryEntry,
} from "./types.js";

import { bindModel } from "./bound.js";
import { WriteAborted } from "./errors.js";

/** Reads a definition's resolved config; definitions carry it under this symbol. */
export const CONFIG: unique symbol = Symbol("@sdxc/data-model.config");

/** Reads the session a bound registry was built on, for the testing factories. */
export const SESSION: unique symbol = Symbol("@sdxc/data-model.session");

/** An `afterCommit` dispatch, run with the context of the binding outside any transaction. */
export type Commit = (ctx: ModelContext) => Promise<void>;

/** The events a unit of work defers to its end. */
export interface UnitOfWork {
	queue: Commit[];
}

/** One binding: what every model bound in it reads and writes through. */
export interface Session {
	db: Database;
	init: ModelContextInit;
	host: ContextHost | undefined;
	transactions: "database" | "none";
	/** The unit of work this binding runs in, or `null` outside one. */
	uow: UnitOfWork | null;
	entries: RegistryEntries;
	models: AnyBoundModels;
	/** The binding outside any transaction, whose context dispatches `afterCommit` events. */
	root: Session | null;
	context: ModelContext | undefined;
}

/** What starting a binding takes. */
export interface SessionInit {
	init: ModelContextInit;
	host: ContextHost | undefined;
	options: BindOptions | undefined;
	entries: RegistryEntries;
	/** An already-published registry object, when the middleware handed one out before binding. */
	models?: AnyBoundModels;
}

/** Starts a binding outside any unit of work. */
export function createSession(init: SessionInit): Session {
	let session: Session = {
		db: init.init.db,
		init: init.init,
		host: init.host,
		transactions: init.options?.transactions ?? "none",
		uow: null,
		entries: init.entries,
		models: init.models as AnyBoundModels,
		root: null,
		context: undefined,
	};
	session.models ??= buildModels(init.entries, () => session);
	return session;
}

/** A binding over another database or unit of work, with its own freshly bound models. */
export function deriveSession(session: Session, db: Database, uow: UnitOfWork | null): Session {
	let derived: Session = {
		...session,
		db,
		uow,
		root: session.root ?? session,
		context: undefined,
		models: undefined as unknown as AnyBoundModels,
	};
	derived.models = buildModels(session.entries, () => derived);
	return derived;
}

/**
 * The context a binding's callbacks receive, built once per binding: the members the binding
 * supplied, its database, the registry bound alongside it, and `get` reading the host.
 */
export function modelContext(session: Session): ModelContext {
	session.context ??= {
		...session.init,
		db: session.db,
		models: session.models,
		get: (key: object) => session.host?.get(key),
	} as unknown as ModelContext;
	return session.context;
}

/** Whether a value is a `Failure` from `@sdxc/result`, which aborts a unit of work. */
export function isFailureResult(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { status?: unknown }).status === "failure" &&
		"error" in value
	);
}

/** Runs deferred `afterCommit` events in order, with the context of the binding outside it. */
async function flush(session: Session, commits: readonly Commit[]): Promise<void> {
	let ctx = modelContext(session.root ?? session);
	for (let commit of commits) await commit(ctx);
}

/** What a write's body reports: its result and the `afterCommit` events it produced. */
export interface WriteOutcome<Value> {
	result: Result<Value, Error>;
	commits: Commit[];
}

/**
 * Runs one model write. Inside a unit of work its events join the unit's queue; outside one,
 * the write gets its own queue, wrapped in `db.transaction()` where the binding has real
 * transactions so a failing `after*` callback rolls the statement back, and its events flush
 * once it succeeds. A write's own events come before those of writes its callbacks made.
 */
export async function runWrite<Value>(
	session: Session,
	body: (scoped: Session) => Promise<WriteOutcome<Value>>,
): Promise<Result<Value, Error>> {
	if (session.uow !== null) {
		let queue = session.uow.queue;
		let mark = queue.length;
		let outcome = await body(session);
		if (outcome.result.status === "success") queue.splice(mark, 0, ...outcome.commits);
		return outcome.result;
	}

	let uow: UnitOfWork = { queue: [] };
	let outcome: WriteOutcome<Value>;

	if (session.transactions === "database") {
		try {
			outcome = await session.db.transaction(async (db) => {
				let inner = await body(deriveSession(session, db, uow));
				if (inner.result.status === "failure") throw new WriteAborted(inner.result);
				return inner;
			});
		} catch (error) {
			if (error instanceof WriteAborted) return error.failure as Result<Value, Error>;
			throw error;
		}
	} else {
		outcome = await body(deriveSession(session, session.db, uow));
		if (outcome.result.status === "failure") return outcome.result;
	}

	await flush(session, [...outcome.commits, ...uow.queue]);
	return outcome.result;
}

/**
 * Opens a unit of work: `fn` receives every model bound to it, and `afterCommit` events queue
 * until `fn` resolves. A success flushes them; a throw or a returned `Failure` drops them, and
 * rolls the database back where the binding has real transactions. A unit opened inside
 * another joins it, sharing its queue and settling with it.
 */
export async function runUnitOfWork<Value>(
	session: Session,
	fn: (models: AnyBoundModels) => Promise<Value>,
): Promise<Value> {
	if (session.uow !== null) return fn(session.models);

	let uow: UnitOfWork = { queue: [] };
	let result: Value;

	if (session.transactions === "database") {
		try {
			result = await session.db.transaction(async (db) => {
				let value = await fn(deriveSession(session, db, uow).models);
				if (isFailureResult(value)) throw new WriteAborted(value);
				return value;
			});
		} catch (error) {
			if (error instanceof WriteAborted) return error.failure as Value;
			throw error;
		}
	} else {
		result = await fn(deriveSession(session, session.db, uow).models);
		if (isFailureResult(result)) return result;
	}

	await flush(session, uow.queue);
	return result;
}

/** Reads the config of a definition, or `undefined` for a lazy loader. */
export function configOf(entry: unknown): ModelConfig | undefined {
	if (typeof entry !== "object" || entry === null) return undefined;
	return (entry as { [CONFIG]?: ModelConfig })[CONFIG];
}

/**
 * Builds a registry's bound models: each entry binds on first access and stays bound for the
 * rest of the binding, so an invocation that touches no model binds none.
 *
 * @param entries The registry's entries.
 * @param getSession Answers the binding, which the middleware creates on first model access.
 */
export function buildModels(entries: RegistryEntries, getSession: () => Session): AnyBoundModels {
	let bound = new Map<string, unknown>();
	let models = {} as Record<string | symbol, unknown>;

	for (let name of Object.keys(entries)) {
		Object.defineProperty(models, name, {
			enumerable: true,
			get() {
				if (!bound.has(name)) bound.set(name, bindEntry(entries[name], getSession()));
				return bound.get(name);
			},
		});
	}

	Object.defineProperty(models, "transaction", {
		value: (fn: (models: AnyBoundModels) => Promise<unknown>) => runUnitOfWork(getSession(), fn),
	});
	Object.defineProperty(models, SESSION, { get: getSession });

	return models as unknown as AnyBoundModels;
}

/** Binds one registry entry: a model directly, a loader through a lazy proxy. */
function bindEntry(entry: RegistryEntry | undefined, session: Session): unknown {
	let config = configOf(entry);
	if (config !== undefined) return bindModel(config, session);
	if (typeof entry === "function") return lazyModel(entry, session);
	throw new TypeError("A registry entry must be a model or a function importing one");
}

/** One recorded call on a deferred value. */
interface Step {
	property: string;
	args: unknown[];
}

/** Query methods that run the query, and so trigger the import and the replay. */
const TERMINALS = new Set([
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
]);

/** Replays recorded calls on the loaded model. */
function replay(model: unknown, steps: readonly Step[]): unknown {
	let value = model;
	for (let step of steps) {
		let method = (value as Record<string, (...args: unknown[]) => unknown>)[step.property];
		if (typeof method !== "function") {
			throw new TypeError(`"${step.property}" is not a method of this model or its queries`);
		}
		value = method.apply(value, step.args);
	}
	return value;
}

/**
 * A call on a model whose module has not loaded. It starts the import and replays the
 * recorded calls on the loaded model right away, so an async method runs whether or not the
 * caller awaits it, and it is a real `Promise` settling with the member's result. Chaining a
 * further call records it and replays the longer chain, so a scope chains and pages as it does
 * on an eager model.
 */
function deferred(load: () => Promise<unknown>, steps: readonly Step[]): unknown {
	let settled = load().then((model) => replay(model, steps));

	return new Proxy(settled, {
		get(target, property) {
			if (property === "then" || property === "catch" || property === "finally") {
				let method = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
				return method.bind(target);
			}
			if (typeof property === "symbol") return Reflect.get(target, property, target);
			if (TERMINALS.has(property)) {
				return (...args: unknown[]) =>
					settled.then((query) =>
						(query as Record<string, (...args: unknown[]) => unknown>)[property]?.(...args),
					);
			}
			return (...args: unknown[]) => deferred(load, [...steps, { property, args }]);
		},
	});
}

/**
 * A registry entry whose module loads on its first call. The import runs once per binding and
 * the bound model is kept; `load()` answers it, for code that needs a real `Query` in hand.
 */
function lazyModel(loader: () => Promise<{ default: unknown }>, session: Session): unknown {
	let loaded: Promise<unknown> | undefined;

	let load = () => {
		loaded ??= loader().then((module) => {
			let config = configOf(module.default);
			if (config === undefined) {
				throw new TypeError("A lazily loaded model module must default-export a model");
			}
			return bindModel(config, session);
		});
		return loaded;
	};

	return new Proxy(
		{},
		{
			get(_, property) {
				if (property === "load") return load;
				if (property === "then" || typeof property === "symbol") return undefined;
				return (...args: unknown[]) => deferred(load, [{ property, args }]);
			},
		},
	);
}
