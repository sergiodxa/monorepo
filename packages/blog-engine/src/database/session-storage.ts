/**
 * SQL-backed {@link SessionStorage} implementation ({@link SqlSessionStorage}) so the
 * engine's only hard dependency stays a single database. Handles server-side
 * expiry and defensive JSON parsing of the stored payload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";
import type { Session, SessionStorage } from "remix/session";

import { createSession } from "remix/session";

import { sessions } from "./schema.js";

/** Default session lifetime (one year). */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

type Data = Record<string, unknown>;

/**
 * A {@link SessionStorage} backed by the engine's own `sessions` table, so the
 * engine's only hard dependency stays a single SQL database. Hosts may inject a
 * different storage via `config.session.storage`.
 */
export class SqlSessionStorage<
	valueData extends Data = Data,
	flashData extends Data = Data,
> implements SessionStorage {
	#db: Database;
	#ttlSeconds: number;

	/**
	 * @param db - Database handle backing the `sessions` table.
	 * @param options.ttlSeconds - Session lifetime; defaults to one year.
	 */
	constructor(db: Database, options: { ttlSeconds?: number } = {}) {
		this.#db = db;
		this.#ttlSeconds = options.ttlSeconds ?? SESSION_TTL_SECONDS;
	}

	/**
	 * Restores a session from its cookie id or returns an empty session. Enforces
	 * server-side expiry: an expired or unparseable row is deleted and a fresh empty
	 * session (keyed to the same id) is returned.
	 * @param cookie - The session id from the cookie, or null when absent.
	 * @returns The restored or a fresh session.
	 */
	async read(cookie: string | null): Promise<Session<valueData, flashData>> {
		if (!cookie) return createSession<valueData, flashData>();

		let row = await this.#db.findOne(sessions, { where: { id: cookie } });
		if (!row) return createSession<valueData, flashData>(cookie);

		let expiresAt = Date.parse(row.expires_at);
		if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
			await this.remove(cookie);
			return createSession<valueData, flashData>(cookie);
		}

		let data = parseData<valueData, flashData>(row.data);
		if (!data) return createSession<valueData, flashData>(cookie);

		return createSession<valueData, flashData>(cookie, data);
	}

	/**
	 * Persists, rotates, or destroys the session. A destroyed session removes the row
	 * and returns `""`; a dirty session is upserted and returns its id; an unchanged
	 * session returns `null` (no `Set-Cookie` needed).
	 * @param session - The session to persist.
	 * @returns The cookie value to set, `""` to clear, or `null` for no change.
	 */
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

	/**
	 * Deletes a session row if it exists (used by rotation and destroy).
	 * @param id - The session id to delete.
	 */
	private async remove(id: string): Promise<void> {
		let existing = await this.#db.findOne(sessions, { where: { id } });
		if (existing) await this.#db.delete(sessions, { id });
	}
}

/**
 * Parses the stored session payload — a JSON `[data, flashData]` tuple — returning
 * `null` on any malformed shape so a bad row degrades to an empty session.
 * @param raw - The JSON-encoded payload from the row.
 * @returns The `[data, flashData]` tuple, or `null` when invalid.
 */
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

/**
 * Narrows an unknown value to a plain object (not null, not an array).
 * @param value - The value to test.
 * @returns True when `value` is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
