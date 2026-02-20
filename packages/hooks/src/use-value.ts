import { useCallback, useSyncExternalStore } from "react";

/**
 * A simple reactive store that holds a value and notifies subscribers on changes.
 *
 * Uses private class fields for encapsulation and a Set to track subscribers,
 * enabling automatic cleanup via reference counting.
 *
 * @template T - The type of value stored
 * @internal
 */
class Store<T> {
	/** The current state value */
	#state: T;

	/** Set of callback functions to notify when state changes */
	#subscribers = new Set<() => void>();

	/** Pending cleanup timeout ID, used to handle React Strict Mode */
	#cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Creates a new store with an initial value.
	 * @param initialState - The initial value for the store
	 */
	constructor(initialState: T) {
		this.#state = initialState;
	}

	/**
	 * Gets the current state value.
	 */
	get state() {
		return this.#state;
	}

	/**
	 * Sets a new state value and notifies all subscribers.
	 * @param newState - The new value to set
	 */
	set state(newState: T) {
		this.#state = newState;
		for (let callback of this.#subscribers) callback();
	}

	/**
	 * Subscribes a callback to be notified when state changes.
	 *
	 * @param callback - Function to call when state changes
	 * @param onEmpty - Optional function to call when the last subscriber unsubscribes.
	 *   Used for cleanup (e.g., removing the store from the collection).
	 * @returns An unsubscribe function that removes the callback and optionally
	 *   triggers the onEmpty callback if no subscribers remain.
	 */
	subscribe(callback: () => void, onEmpty?: () => void) {
		// Cancel any pending cleanup from a previous unsubscribe
		if (this.#cleanupTimeout) {
			clearTimeout(this.#cleanupTimeout);
			this.#cleanupTimeout = null;
		}

		this.#subscribers.add(callback);
		return () => {
			this.#subscribers.delete(callback);
			if (this.#subscribers.size === 0 && onEmpty) {
				// Delay cleanup to handle React Strict Mode's mount/unmount/remount cycle.
				// If the store is re-subscribed before the timeout, the cleanup is cancelled.
				this.#cleanupTimeout = setTimeout(() => {
					this.#cleanupTimeout = null;
					// Double-check that we still have no subscribers
					if (this.#subscribers.size === 0) onEmpty();
				}, 0);
			}
		};
	}
}

/**
 * Global collection of all stores, keyed by symbol.
 *
 * This is a module-level singleton that persists for the lifetime of the app.
 * Each entry maps a symbol key to its corresponding Store instance.
 *
 * The collection itself is a Store so it could support subscribing to changes
 * in the collection (e.g., when stores are added/removed), though this
 * capability is not currently used.
 *
 * @internal
 */
const collection = new Store<Map<symbol, Store<unknown>>>(new Map());

/**
 * Gets an existing store for the given key, or creates a new one if it doesn't exist.
 *
 * This function is idempotent - calling it multiple times with the same key
 * returns the same store instance. The initialValue is only used when creating
 * a new store; it's ignored if a store already exists for the key.
 *
 * @template T - The type of value stored
 * @param key - Symbol key to identify the store
 * @param initialValue - Value to use if creating a new store
 * @returns The existing or newly created store
 * @internal
 */
function getOrCreateStore<T>(key: symbol, initialValue: T): Store<T> {
	let existing = collection.state.get(key);
	if (existing) return existing as Store<T>;

	let store = new Store<T>(initialValue);
	collection.state.set(key, store);
	return store;
}

/**
 * Share state between components without prop drilling or context.
 *
 * Creates a global store keyed by a symbol that any component can subscribe to.
 * When multiple components use the same key, they share the same state.
 * The store is automatically cleaned up when no components are subscribed.
 *
 * @param key - A symbol to identify the shared state. Use `Symbol.for("name")`
 *   to create a consistent key across modules.
 * @param initialValue - The initial value used when the store is first created.
 *   Ignored if a store for this key already exists.
 * @returns A tuple of `[state, setState]` similar to `useState`.
 *
 * @example
 * ```tsx
 * // In ComponentA (e.g., in /dashboard route)
 * let [count, setCount] = useValue(Symbol.for("counter"), 0);
 *
 * // In ComponentB (e.g., in /settings route)
 * let [count, setCount] = useValue(Symbol.for("counter"), 0);
 * // Both components share the same count state
 * ```
 *
 * @example
 * ```tsx
 * // Define keys in a shared constants file for type safety
 * const KEYS = {
 *   counter: Symbol.for("app:counter"),
 *   user: Symbol.for("app:user"),
 * } as const;
 *
 * function Counter() {
 *   let [count, setCount] = useValue(KEYS.counter, 0);
 *   return <button onClick={() => setCount(count + 1)}>{count}</button>;
 * }
 * ```
 */
export function useValue<T>(key: symbol, initialValue: T) {
	let store = getOrCreateStore(key, initialValue);

	let state = useSyncExternalStore(
		(callback) => store.subscribe(callback, () => collection.state.delete(key)),
		() => store.state,
		() => initialValue,
	);

	let setter = useCallback(
		(newValue: T) => {
			store.state = newValue;
		},
		[store],
	);

	return [state, setter] as const;
}
