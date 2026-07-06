/**
 * KV-backed session storage adapter implementing Remix's `SessionStorage`. It persists
 * session data as JSON in a KV store under a configurable key prefix with a configurable
 * TTL, and supports reading, saving, rotating, and destroying sessions. It exists to back
 * sessions with edge KV storage instead of cookies or a relational database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Session, SessionStorage } from "remix/session";

import { createSession } from "remix/session";

import type { KVStore } from "~/app/contracts/kv-store";

/**
 * Default KV TTL used when no custom session lifetime is provided.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

/**
 * Default key prefix used to isolate session entries in KV.
 */
const SESSION_PREFIX = "session:";

/**
 * Session-related types for configuring and shaping KV-backed session data.
 */
export namespace KVSessionStorage {
	/**
	 * Generic object shape used for persisted and flash session payloads.
	 */
	export type Data = Record<string, unknown>;

	/**
	 * Storage behavior overrides for key prefix and expiration.
	 */
	export interface Options {
		/**
		 * Session expiration in seconds for KV writes.
		 */
		ttlSeconds?: number;

		/**
		 * Prefix prepended to every KV session key.
		 */
		prefix?: string;
	}
}

/**
 * Persists Remix sessions in KV with JSON serialization and configurable TTL.
 */
export class KVSessionStorage<
	valueData extends KVSessionStorage.Data = KVSessionStorage.Data,
	flashData extends KVSessionStorage.Data = KVSessionStorage.Data,
> implements SessionStorage {
	#kv: KVStore;
	#options: KVSessionStorage.Options;

	/**
	 * Creates a KV-backed session storage adapter.
	 */
	constructor(kv: KVStore, options: KVSessionStorage.Options = {}) {
		this.#kv = kv;
		this.#options = options;
	}

	/**
	 * Restores a session from its cookie id or returns an empty session.
	 */
	async read(cookie: string | null) {
		if (!cookie) return createSession<valueData, flashData>();

		let raw = await this.#kv.get(this.key(cookie));
		if (!raw) return createSession<valueData, flashData>(cookie);

		let data = parseSessionData<valueData, flashData>(raw);
		if (!data) return createSession<valueData, flashData>(cookie);

		return createSession<valueData, flashData>(cookie, data);
	}

	/**
	 * Persists, rotates, or destroys the current session state in KV.
	 */
	async save(currentSession: Session<valueData, flashData>) {
		if (currentSession.deleteId) {
			await this.#kv.delete(this.key(currentSession.deleteId));
		}

		if (currentSession.destroyed) {
			await this.#kv.delete(this.key(currentSession.id));
			return "";
		}

		if (currentSession.dirty) {
			await this.#kv.put(this.key(currentSession.id), JSON.stringify(currentSession.data), {
				expirationTtl: this.ttlSeconds,
			});

			return currentSession.id;
		}

		return null;
	}

	private get prefix() {
		return this.#options.prefix ?? SESSION_PREFIX;
	}

	private get ttlSeconds() {
		return this.#options.ttlSeconds ?? SESSION_TTL_SECONDS;
	}

	private key(sessionId: string) {
		return `${this.prefix}${sessionId}`;
	}
}

/**
 * Parses serialized session data and validates the expected tuple shape.
 */
function parseSessionData<
	valueData extends KVSessionStorage.Data,
	flashData extends KVSessionStorage.Data,
>(raw: string): [valueData, flashData] | null {
	try {
		let parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed) || parsed.length !== 2) return null;
		if (!isRecord(parsed[0]) || !isRecord(parsed[1])) return null;
		return [parsed[0] as valueData, parsed[1] as flashData];
	} catch {
		return null;
	}
}

/**
 * Checks whether a value is a plain object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
