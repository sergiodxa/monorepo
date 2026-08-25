/**
 * KV-backed session storage adapter for remix/session. It implements SessionStorage
 * by reading, writing, and destroying JSON-serialized session payloads in a key-value
 * store under a configurable key prefix and TTL, validating the stored tuple shape on
 * read. It exists so Cloudflare Workers apps can persist Remix sessions on Workers KV —
 * Remix ships cookie/fs/memory/redis/memcache session stores but none for Workers KV.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";
import type { Session, SessionStorage } from "remix/session";

import { toSeconds } from "@pkg/duration";
import { createSession } from "remix/session";

import type { KVStore } from "./kv-store";

/**
 * Default KV TTL used when no custom session lifetime is provided.
 */
const SESSION_TTL_SECONDS = toSeconds("365 days");

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
		 * How long a saved session survives in KV. A bare number is whole seconds,
		 * the unit KV expiration counts; a duration string states its own unit,
		 * so `3600` and `"1 hour"` are equivalent.
		 */
		ttlSeconds?: DurationInput;

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

	/**
	 * Session lifetime in the whole seconds KV expiration counts, falling back to
	 * the package default when the caller did not configure one.
	 */
	private get ttlSeconds() {
		let ttl = this.#options.ttlSeconds ?? SESSION_TTL_SECONDS;
		if (typeof ttl === "number") return ttl;
		return toSeconds(ttl);
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
