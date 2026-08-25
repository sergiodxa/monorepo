/**
 * KV-backed session storage adapter implementing Remix's `SessionStorage`. Session data
 * is stored as JSON under a configurable key prefix with a configurable TTL, so sessions
 * live in edge KV and expire on their own once that TTL lapses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Session, SessionStorage } from "remix/session";

import { createSession } from "remix/session";

import type { KVStore } from "~/app/contracts/kv-store";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

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
		ttlSeconds?: number;

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
