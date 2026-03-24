import type { Session, SessionStorage } from "remix/session";

import { createSession } from "remix/session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const SESSION_PREFIX = "session:";

export namespace KVSessionStorage {
	export type Data = Record<string, unknown>;

	export interface Options {
		ttlSeconds?: number;
		prefix?: string;
	}
}

export class KVSessionStorage<
	valueData extends KVSessionStorage.Data = KVSessionStorage.Data,
	flashData extends KVSessionStorage.Data = KVSessionStorage.Data,
> implements SessionStorage {
	#kv: KVNamespace;
	#options: KVSessionStorage.Options;

	constructor(kv: KVNamespace, options: KVSessionStorage.Options = {}) {
		this.#kv = kv;
		this.#options = options;
	}

	async read(cookie: string | null) {
		if (!cookie) return createSession<valueData, flashData>();

		let raw = await this.#kv.get(this.key(cookie));
		if (!raw) return createSession<valueData, flashData>(cookie);

		let data = parseSessionData<valueData, flashData>(raw);
		if (!data) return createSession<valueData, flashData>(cookie);

		return createSession<valueData, flashData>(cookie, data);
	}

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
