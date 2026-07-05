import type { Database } from "remix/data-table";
import type { Session, SessionStorage } from "remix/session";

import { createSession } from "remix/session";

import { sessions } from "./schema";

/** Default session lifetime (one year), matching r3-blog. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

type Data = Record<string, unknown>;

/**
 * A {@link SessionStorage} backed by the engine's own `sessions` table, so the
 * engine's only hard dependency stays a single SQL database (no KV needed). Hosts
 * may inject a different storage via `config.session.storage`.
 */
export class SqlSessionStorage<
	valueData extends Data = Data,
	flashData extends Data = Data,
> implements SessionStorage {
	#db: Database;
	#ttlSeconds: number;

	constructor(db: Database, options: { ttlSeconds?: number } = {}) {
		this.#db = db;
		this.#ttlSeconds = options.ttlSeconds ?? SESSION_TTL_SECONDS;
	}

	/** Restores a session from its cookie id or returns an empty session. */
	async read(cookie: string | null): Promise<Session<valueData, flashData>> {
		if (!cookie) return createSession<valueData, flashData>();

		let row = await this.#db.findOne(sessions, { where: { id: cookie } });
		if (!row) return createSession<valueData, flashData>(cookie);

		let data = parseData<valueData, flashData>(row.data);
		if (!data) return createSession<valueData, flashData>(cookie);

		return createSession<valueData, flashData>(cookie, data);
	}

	/** Persists, rotates, or destroys the session and returns the cookie value. */
	async save(session: Session<valueData, flashData>): Promise<string | null> {
		if (session.deleteId) await this.remove(session.deleteId);

		if (session.destroyed) {
			await this.remove(session.id);
			return "";
		}

		if (session.dirty) {
			let now = new Date().toISOString();
			let expiresAt = new Date(Date.now() + this.#ttlSeconds * 1000).toISOString();
			let payload = JSON.stringify(session.data);
			let existing = await this.#db.findOne(sessions, { where: { id: session.id } });
			if (existing) {
				await this.#db.update(
					sessions,
					{ id: session.id },
					{ data: payload, expires_at: expiresAt, updated_at: now },
				);
			} else {
				await this.#db.create(sessions, {
					id: session.id,
					data: payload,
					expires_at: expiresAt,
					created_at: now,
					updated_at: now,
				});
			}
			return session.id;
		}

		return null;
	}

	private async remove(id: string): Promise<void> {
		let existing = await this.#db.findOne(sessions, { where: { id } });
		if (existing) await this.#db.delete(sessions, { id });
	}
}

function parseData<valueData extends Data, flashData extends Data>(
	raw: string,
): [valueData, flashData] | null {
	try {
		let parsed: unknown = JSON.parse(raw);
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
