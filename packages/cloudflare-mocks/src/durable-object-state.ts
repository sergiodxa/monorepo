/**
 * `DurableObjectState` with working key-value storage, a SQL-backed `storage.sql`, real
 * transaction rollback, alarms, and serialized `blockConcurrencyWhile`. It lets a Durable
 * Object class be tested by construction instead of through a stubbed namespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createSqlStorage } from "./sql-storage";

/** Options for {@link createDurableObjectState}. */
export interface DurableObjectStateMockOptions<Props> {
	/** Name the id reports, as if the stub had been obtained with `idFromName`. */
	name?: string;
	/** Hex id string; generated when omitted. */
	id?: string;
	/** Value exposed as `state.props`. */
	props?: Props;
}

/** A `DurableObjectState` whose deferred work, abort, and sockets can be inspected. */
export interface DurableObjectStateMock<Props = unknown> extends DurableObjectState<Props> {
	/** Promises handed to `waitUntil`, in registration order. */
	readonly waitUntilPromises: readonly Promise<unknown>[];
	/** Reason passed to `abort`, or `undefined` while the object is live. */
	readonly abortReason: string | undefined;

	/**
	 * Awaits every registered `waitUntil` promise, including ones registered while
	 * awaiting.
	 * @throws The first rejection, so failed background work fails the test.
	 */
	settled(): Promise<void>;
}

/**
 * Creates a Durable Object state backed by in-memory storage and a real SQLite database.
 * Values are structured-cloned on write and read, matching the platform's serialization,
 * so each caller holds an independent copy of anything stored or retrieved.
 * @param options Identity and props for the object.
 * @returns A `DurableObjectState` usable as a Durable Object constructor argument.
 * @example let state = createDurableObjectState(); let object = new Counter(state, env);
 */
export function createDurableObjectState<Props = unknown>(
	options?: DurableObjectStateMockOptions<Props>,
): DurableObjectStateMock<Props> {
	let entries = new Map<string, unknown>();
	let sql = createSqlStorage();
	let alarm: number | null = null;
	let sockets = new Map<WebSocket, string[]>();
	let autoResponse: WebSocketRequestResponsePair | null = null;
	let autoResponseTimestamps = new Map<WebSocket, Date>();
	let hibernationTimeout: number | null = null;
	let waitUntilPromises: Promise<unknown>[] = [];
	let gate: Promise<void> = Promise.resolve();
	let abortReason: string | undefined;
	let bookmark = 0;

	let id: DurableObjectId = {
		/** Hex id string, stable for the object's lifetime. */
		toString(): string {
			return options?.id ?? "0".repeat(64);
		},

		/**
		 * Compares two ids by their string form.
		 * @param other Id to compare against.
		 */
		equals(other: DurableObjectId): boolean {
			return other.toString() === this.toString();
		},

		name: options?.name,
	};

	/** Reads a live copy of a key, so the caller cannot mutate what is stored. */
	function read(key: string): unknown {
		if (!entries.has(key)) return undefined;
		return structuredClone(entries.get(key));
	}

	/** Writes a cloned copy of a value, matching the platform's serialization. */
	function write(key: string, value: unknown): void {
		entries.set(key, structuredClone(value));
	}

	/** Applies list ordering, bounds, and limit over the current key set. */
	function listEntries(listOptions?: DurableObjectListOptions): Map<string, unknown> {
		let keys = [...entries.keys()].sort();
		let prefix = listOptions?.prefix ?? "";

		let selected = keys.filter((key) => {
			if (!key.startsWith(prefix)) return false;
			if (listOptions?.start !== undefined && key < listOptions.start) return false;
			if (listOptions?.startAfter !== undefined && key <= listOptions.startAfter) return false;
			if (listOptions?.end !== undefined && key >= listOptions.end) return false;
			return true;
		});

		if (listOptions?.reverse) selected.reverse();
		if (listOptions?.limit !== undefined) selected = selected.slice(0, listOptions.limit);

		return new Map(selected.map((key) => [key, read(key)]));
	}

	/**
	 * Lists stored entries in key order.
	 * @param listOptions `prefix`, `start`/`startAfter`/`end` bounds, `reverse`, `limit`.
	 * @returns The matching entries, keyed by name.
	 */
	function list<T = unknown>(listOptions?: DurableObjectListOptions): Promise<Map<string, T>> {
		return Promise.resolve(listEntries(listOptions) as Map<string, T>);
	}

	/**
	 * Reads one key, or many keys at once.
	 * @param key Key, or keys for a bulk read.
	 * @returns The value, `undefined` when absent, or a map of the found keys.
	 */
	function get<T = unknown>(key: string, options?: DurableObjectGetOptions): Promise<T | undefined>;
	function get<T = unknown>(
		keys: string[],
		options?: DurableObjectGetOptions,
	): Promise<Map<string, T>>;
	function get(key: string | string[]): Promise<unknown> {
		if (!Array.isArray(key)) return Promise.resolve(read(key));

		let found = new Map<string, unknown>();

		for (let name of key) {
			if (entries.has(name)) found.set(name, read(name));
		}

		return Promise.resolve(found);
	}

	/**
	 * Writes one key, or every entry of a record.
	 * @param keyOrEntries Key, or a record of keys to values.
	 * @param value Value, when writing a single key.
	 */
	function put<T>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
	function put<T>(entries: Record<string, T>, options?: DurableObjectPutOptions): Promise<void>;
	function put(keyOrEntries: string | Record<string, unknown>, value?: unknown): Promise<void> {
		if (typeof keyOrEntries === "string") {
			write(keyOrEntries, value);
			return Promise.resolve();
		}

		for (let [key, entry] of Object.entries(keyOrEntries)) write(key, entry);

		return Promise.resolve();
	}

	/**
	 * Deletes one key, or many.
	 * @param keys Key, or keys to delete.
	 * @returns Whether the single key existed, or how many of the keys did.
	 */
	function remove(key: string, options?: DurableObjectPutOptions): Promise<boolean>;
	function remove(keys: string[], options?: DurableObjectPutOptions): Promise<number>;
	function remove(keys: string | string[]): Promise<boolean | number> {
		if (!Array.isArray(keys)) return Promise.resolve(entries.delete(keys));

		let deleted = 0;
		for (let key of keys) {
			if (entries.delete(key)) deleted += 1;
		}

		return Promise.resolve(deleted);
	}

	/** Builds the transaction handle, which writes through and can be rolled back. */
	function createTransaction(markRollback: () => void): DurableObjectTransaction {
		return {
			get,
			list,
			put,
			delete: remove,

			/** Marks the transaction to be discarded when the closure returns. */
			rollback: markRollback,

			/** Scheduled alarm time, or `null` when none is set. */
			getAlarm(): Promise<number | null> {
				return Promise.resolve(alarm);
			},

			/**
			 * Schedules the alarm.
			 * @param scheduledTime When the alarm should fire.
			 */
			setAlarm(scheduledTime: number | Date): Promise<void> {
				alarm = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
				return Promise.resolve();
			},

			/** Clears any scheduled alarm. */
			deleteAlarm(): Promise<void> {
				alarm = null;
				return Promise.resolve();
			},
		};
	}

	let storage: DurableObjectStorage = {
		get,
		put,
		delete: remove,

		list,

		/** Removes every stored key; SQL-backed tables keep their own lifecycle. */
		deleteAll(): Promise<void> {
			entries.clear();
			return Promise.resolve();
		},

		/**
		 * Runs a closure against a transactional view of storage.
		 *
		 * Writes are discarded when the closure throws or calls `rollback()`, so a partly
		 * applied multi-key update cannot survive a failure.
		 * @param closure Work to run inside the transaction.
		 * @returns Whatever the closure returned.
		 */
		async transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T> {
			let snapshot = new Map(entries);
			let snapshotAlarm = alarm;
			let rollingBack = false;

			try {
				let result = await closure(
					createTransaction(() => {
						rollingBack = true;
					}),
				);

				if (rollingBack) {
					entries = snapshot;
					alarm = snapshotAlarm;
				}

				return result;
			} catch (error) {
				entries = snapshot;
				alarm = snapshotAlarm;
				throw error;
			}
		},

		/**
		 * Runs a synchronous closure atomically across both key-value storage and SQL.
		 * @param closure Work to run inside the transaction.
		 * @returns Whatever the closure returned.
		 */
		transactionSync<T>(closure: () => T): T {
			let snapshot = new Map(entries);
			sql.exec("BEGIN");

			try {
				let result = closure();
				sql.exec("COMMIT");
				return result;
			} catch (error) {
				sql.exec("ROLLBACK");
				entries = snapshot;
				throw error;
			}
		},

		/** Scheduled alarm time, or `null` when none is set. */
		getAlarm(): Promise<number | null> {
			return Promise.resolve(alarm);
		},

		/**
		 * Schedules the alarm. A test calls the object's `alarm()` handler directly to
		 * fire it, which is what makes the timing assertable.
		 * @param scheduledTime When the alarm should fire.
		 */
		setAlarm(scheduledTime: number | Date): Promise<void> {
			alarm = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
			return Promise.resolve();
		},

		/** Clears any scheduled alarm. */
		deleteAlarm(): Promise<void> {
			alarm = null;
			return Promise.resolve();
		},

		/** Resolves immediately; in-memory writes are already durable for a test's purposes. */
		sync(): Promise<void> {
			return Promise.resolve();
		},

		sql,

		kv: {
			/**
			 * Reads a key synchronously.
			 * @param key Key to read.
			 */
			get<T = unknown>(key: string): T | undefined {
				return read(key) as T | undefined;
			},

			/**
			 * Lists entries synchronously in key order.
			 * @param listOptions `prefix`, bounds, `reverse`, and `limit`.
			 */
			list<T = unknown>(listOptions?: SyncKvListOptions): Iterable<[string, T]> {
				return listEntries(listOptions) as Iterable<[string, T]>;
			},

			/**
			 * Writes a key synchronously.
			 * @param key Key to write.
			 * @param value Value to store.
			 */
			put<T>(key: string, value: T): void {
				write(key, value);
			},

			/**
			 * Deletes a key synchronously.
			 * @param key Key to delete.
			 * @returns Whether the key existed.
			 */
			delete(key: string): boolean {
				return entries.delete(key);
			},
		},

		/** Synthetic bookmark for the current point in the object's history. */
		getCurrentBookmark(): Promise<string> {
			bookmark += 1;
			return Promise.resolve(`mock-bookmark-${String(bookmark)}`);
		},

		/**
		 * Synthetic bookmark for a past point in time.
		 * @param timestamp Point in time to name.
		 */
		getBookmarkForTime(timestamp: number | Date): Promise<string> {
			let time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
			return Promise.resolve(`mock-bookmark-at-${String(time)}`);
		},

		/**
		 * Records a restore request. There is no session to restore in memory, so the
		 * bookmark is simply echoed back.
		 * @param requested Bookmark to restore to.
		 */
		onNextSessionRestoreBookmark(requested: string): Promise<string> {
			return Promise.resolve(requested);
		},
	};

	return {
		id,
		storage,

		get waitUntilPromises(): readonly Promise<unknown>[] {
			return [...waitUntilPromises];
		},

		get abortReason(): string | undefined {
			return abortReason;
		},

		/**
		 * Registers background work to be awaited later.
		 * @param promise Work that must finish after the response is returned.
		 */
		waitUntil(promise: Promise<unknown>): void {
			waitUntilPromises.push(promise);
		},

		async settled(): Promise<void> {
			let awaited = 0;

			while (awaited < waitUntilPromises.length) {
				let pending = waitUntilPromises.slice(awaited);
				awaited = waitUntilPromises.length;
				await Promise.all(pending);
			}
		},

		/**
		 * Runs a callback with input serialized behind it — the guarantee constructors
		 * rely on for initialization. The gate is claimed before awaiting the previous
		 * one, so callers arriving mid-queue take their turn in arrival order.
		 * @param callback Work to run exclusively.
		 * @returns Whatever the callback returned.
		 */
		async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
			let previous = gate;
			let release = () => undefined as void;

			gate = new Promise<void>((resolve) => {
				release = resolve;
			});

			await previous;

			try {
				return await callback();
			} finally {
				release();
			}
		},

		/**
		 * Marks the object aborted.
		 * @param reason Reason recorded for assertions.
		 */
		abort(reason?: string): void {
			abortReason = reason ?? "aborted";
		},

		/**
		 * Accepts a hibernatable WebSocket.
		 * @param ws Socket to track.
		 * @param tags Tags the socket can later be looked up by.
		 */
		acceptWebSocket(ws: WebSocket, tags?: string[]): void {
			sockets.set(ws, tags ? [...tags] : []);
		},

		/**
		 * Lists accepted sockets.
		 * @param tag Restricts the result to sockets carrying this tag.
		 */
		getWebSockets(tag?: string): WebSocket[] {
			let all = [...sockets.entries()];
			if (tag === undefined) return all.map(([ws]) => ws);

			return all.filter(([, tags]) => tags.includes(tag)).map(([ws]) => ws);
		},

		/**
		 * Tags a socket was accepted with.
		 * @param ws Socket to inspect.
		 */
		getTags(ws: WebSocket): string[] {
			return [...(sockets.get(ws) ?? [])];
		},

		/**
		 * Sets the automatic ping/pong pair used while hibernating.
		 * @param maybeReqResp Pair to install, or nothing to clear it.
		 */
		setWebSocketAutoResponse(maybeReqResp?: WebSocketRequestResponsePair): void {
			autoResponse = maybeReqResp ?? null;
		},

		/** Installed automatic response pair, or `null`. */
		getWebSocketAutoResponse(): WebSocketRequestResponsePair | null {
			return autoResponse;
		},

		/**
		 * Last time an automatic response was sent to a socket.
		 * @param ws Socket to inspect.
		 */
		getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null {
			return autoResponseTimestamps.get(ws) ?? null;
		},

		/**
		 * Sets the hibernatable event timeout.
		 * @param timeoutMs Timeout in milliseconds, or nothing to clear it.
		 */
		setHibernatableWebSocketEventTimeout(timeoutMs?: number): void {
			hibernationTimeout = timeoutMs ?? null;
		},

		/** Configured hibernatable event timeout, or `null`. */
		getHibernatableWebSocketEventTimeout(): number | null {
			return hibernationTimeout;
		},

		/**
		 * `props` is untyped at the platform boundary and has no meaningful default, so
		 * an omitted value passes through unchanged.
		 */
		props: options?.props as Props,

		/** Rejects access to the RPC entrypoints, which have no in-memory equivalent. */
		get exports(): Cloudflare.Exports {
			throw new Error("DurableObjectState.exports is not implemented by @sdxc/cloudflare-mocks");
		},

		/** Rejects access to facets, which require a live Durable Object runtime. */
		get facets(): DurableObjectFacets {
			throw new Error("DurableObjectState.facets is not implemented by @sdxc/cloudflare-mocks");
		},
	};
}
