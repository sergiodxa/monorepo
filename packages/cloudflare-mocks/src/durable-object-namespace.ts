import type { FetcherHandler } from "./fetcher";

/**
 * `DurableObjectNamespace` binding that routes to caller-supplied stubs. The object a
 * namespace hands back is the unit under test's collaborator, not its storage, so this
 * mock owns routing and identity and leaves the object's behaviour to the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createFetcher } from "./fetcher";

/**
 * Builds the object a name routes to.
 *
 * Returning a handler is the common case — the stub answers `fetch` and nothing else. A
 * fuller object is accepted for a stub that also exposes RPC methods the caller invokes.
 * @param name Name the caller resolved.
 */
export type DurableObjectStubFactory = (name: string) => FetcherHandler | object;

/**
 * A `DurableObjectNamespace` binding that routes names to supplied stubs.
 *
 * `T` is the branded Durable Object type the binding is declared with, so a mock assigned
 * to a generated `Env` matches it without a cast, and RPC methods on the stub stay typed.
 */
export interface DurableObjectNamespaceMock<
	T extends Rpc.DurableObjectBranded | undefined = undefined,
> extends DurableObjectNamespace<T> {
	/** Names resolved so far, in first-resolution order and without duplicates. */
	readonly names: readonly string[];

	/**
	 * Forgets every stub built so far, so the next resolution builds a fresh one.
	 *
	 * A binding installed once at module scope outlives the test that used it, and the
	 * stubs it memoized outlive it too; this is how a `beforeEach` gets new objects without
	 * re-creating the `env` the code under test already captured.
	 */
	reset(): void;
}

/**
 * Creates a Durable Object namespace binding.
 *
 * A name resolves to the same stub every time, which is the property the platform
 * guarantees and the one code under test relies on when it addresses an object by name
 * from more than one place. Ids carry the name they were derived from, so resolving
 * through `idFromName` and then `get` reaches the same object as `getByName`.
 * @param createStub Builds the object a name routes to.
 * @returns A `DurableObjectNamespace` binding that routes to those objects.
 * @example let blogs = createDurableObjectNamespace(() => async () => new Response("ok"));
 * @example let blogs = createDurableObjectNamespace((name) => ({ fetch: async () => json({ name }) }));
 */
export function createDurableObjectNamespace<
	T extends Rpc.DurableObjectBranded | undefined = undefined,
>(createStub: DurableObjectStubFactory): DurableObjectNamespaceMock<T> {
	let stubs = new Map<string, DurableObjectStub<T>>();
	let names: string[] = [];

	/** Builds the stub for a name once, then hands back that same object. */
	function resolve(name: string): DurableObjectStub<T> {
		let existing = stubs.get(name);
		if (existing) return existing;

		let built = createStub(name);
		let stub = toStub<T>(name, built);

		stubs.set(name, stub);
		names.push(name);

		return stub;
	}

	return {
		get names(): readonly string[] {
			return [...names];
		},

		reset(): void {
			stubs.clear();
			names.length = 0;
		},

		/**
		 * Resolves an object by name.
		 * @param name Name identifying the object.
		 * @returns The stub the factory built for that name.
		 */
		getByName(name: string): DurableObjectStub<T> {
			return resolve(name);
		},

		/**
		 * Resolves an object by id.
		 * @param id Id produced by {@link idFromName} or {@link newUniqueId}.
		 * @returns The stub the factory built for the name behind that id.
		 */
		get(id: DurableObjectId): DurableObjectStub<T> {
			return resolve(id.toString());
		},

		/**
		 * Derives the id for a name.
		 * @param name Name identifying the object.
		 * @returns An id that resolves back to the same object.
		 */
		idFromName(name: string): DurableObjectId {
			return createId(name);
		},

		/**
		 * Rebuilds an id from its string form.
		 * @param id String previously produced by `DurableObjectId.toString()`.
		 * @returns An id equal to the original.
		 */
		idFromString(id: string): DurableObjectId {
			return createId(id);
		},

		/**
		 * Mints an id no name maps to.
		 * @returns An id for a fresh, anonymous object.
		 */
		newUniqueId(): DurableObjectId {
			return createId(crypto.randomUUID());
		},

		/**
		 * Rejects jurisdiction-scoped namespaces, which have no in-memory equivalent.
		 *
		 * A jurisdiction changes where an object is placed, not what it does, so a mock that
		 * silently returned itself would let a test claim placement it never verified.
		 */
		jurisdiction(): DurableObjectNamespace<T> {
			throw new Error(
				"DurableObjectNamespace.jurisdiction is not implemented by @pkg/cloudflare-mocks",
			);
		},
	};
}

/**
 * Distinguishes the handler shorthand from a full stub object.
 *
 * A bare `typeof === "function"` check does not narrow the union, because the `object` arm
 * admits functions too; stating the predicate here keeps the call site free of a cast.
 */
function isHandler(built: FetcherHandler | object): built is FetcherHandler {
	return typeof built === "function";
}

/** Wraps whatever the factory returned as a stub, giving it identity and a `fetch`. */
function toStub<T extends Rpc.DurableObjectBranded | undefined>(
	name: string,
	built: FetcherHandler | object,
): DurableObjectStub<T> {
	let base = isHandler(built) ? createFetcher(built) : built;

	// The one cast in the module: a branded stub type cannot be produced structurally, so
	// the shape is assembled here and asserted once rather than at every call site.
	return Object.assign(Object.create(null) as object, base, {
		id: createId(name),
		name,
	}) as DurableObjectStub<T>;
}

/** Builds an id that remembers its name, which is how `get` routes back to `getByName`. */
function createId(name: string): DurableObjectId {
	return {
		name,

		/** The name the id was derived from, which is also its string form. */
		toString(): string {
			return name;
		},

		/**
		 * Compares two ids by the object they address.
		 * @param other Id to compare against.
		 */
		equals(other: DurableObjectId): boolean {
			return other.toString() === name;
		},
	};
}
