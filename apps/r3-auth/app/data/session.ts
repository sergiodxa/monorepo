/**
 * Data access for refresh-token sessions: creation, lookup, per-subject listing for
 * the device list, touching on refresh, revocation by id/subject/subject+client, and
 * the expiry sweep the cleanup job runs. A session's id **is** the refresh token, so
 * it is treated as a secret and keeps one value for the session's life.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { toMs } from "@pkg/duration";
import { generateUUID } from "@pkg/uuid";
import { gt, lte } from "remix/data-table";

import type { SelectClient, SelectSession } from "~/database/schema";

import { sessionClient, sessions } from "~/database/schema";

/** How long a new session — and so the refresh token that is its id — stays valid. */
export const SESSION_TTL = toMs("30 days");

/** A session with the client it was issued to, for the account area's device list. */
export interface SessionWithClient extends SelectSession {
	client: SelectClient | null;
}

export default class Session {
	/**
	 * Opens a session for a subject on a client and returns it. The generated id is the
	 * refresh token the client will present, and `expires_at` is stamped here because
	 * the column carries no database default. `scope` is stored so a later refresh can
	 * reissue tokens as broad as the ones the session started with.
	 */
	static async create(
		db: Database,
		subjectId: string,
		clientId: string,
		ip: string | null,
		ua: string | null,
		scope: string[] = ["openid"],
	): Promise<SelectSession> {
		return await db.create(
			sessions,
			{
				id: generateUUID(),
				subject_id: subjectId,
				client_id: clientId,
				ip_address: ip,
				user_agent: ua,
				expires_at: Date.now() + SESSION_TTL,
				scope: scope.join(" "),
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Finds a session by id — that is, resolves a presented refresh token. */
	static async findById(db: Database, id: string): Promise<SelectSession | null> {
		return await db.findOne(sessions, { where: { id } });
	}

	/**
	 * Lists a subject's sessions with the client each belongs to, most recently used
	 * first, which is the order the account area's device list shows them in.
	 */
	static async findBySubjectId(db: Database, subjectId: string): Promise<SessionWithClient[]> {
		return await db.findMany(sessions, {
			where: { subject_id: subjectId },
			orderBy: ["updated_at", "desc"],
			with: { client: sessionClient },
		});
	}

	/** Revokes one session, which invalidates the refresh token it is named by. */
	static async deleteById(db: Database, id: string): Promise<boolean> {
		return await db.delete(sessions, id);
	}

	/** Records that a session was just used, so the device list reflects real activity. */
	static async touch(db: Database, id: string): Promise<SelectSession> {
		return await db.update(sessions, id, {}, { touch: true });
	}

	/** Revokes every session a subject has, across all clients. */
	static async deleteBySubjectId(db: Database, subjectId: string): Promise<number> {
		let result = await db.deleteMany(sessions, { where: { subject_id: subjectId } });
		return result.affectedRows ?? 0;
	}

	/** Revokes a subject's sessions with one client, as consent withdrawal does. */
	static async deleteBySubjectAndClient(
		db: Database,
		subjectId: string,
		clientId: string,
	): Promise<number> {
		let result = await db.deleteMany(sessions, {
			where: { subject_id: subjectId, client_id: clientId },
		});
		return result.affectedRows ?? 0;
	}

	/** Sessions whose expiry has passed, ready for the sweep to remove. */
	static async findExpiredSessions(db: Database): Promise<SelectSession[]> {
		return await db.findMany(sessions, { where: lte("expires_at", Date.now()) });
	}

	/**
	 * Deletes every expired session in one statement, which is what makes the sweep
	 * safe on a database with no interactive transactions.
	 *
	 * @returns How many sessions were removed.
	 */
	static async deleteExpiredSessions(db: Database): Promise<number> {
		let result = await db.deleteMany(sessions, { where: lte("expires_at", Date.now()) });
		return result.affectedRows ?? 0;
	}

	/** Number of sessions still inside their expiry, for the admin dashboard. */
	static async countActive(db: Database): Promise<number> {
		return await db.count(sessions, { where: gt("expires_at", Date.now()) });
	}
}
