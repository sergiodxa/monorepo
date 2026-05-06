import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

/**
 * Model for user sessions.
 * Manages session lifecycle including creation, refresh, and revocation.
 */
export default class Session {
	/** Database table schema for sessions. */
	static table = table({
		name: "sessions",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			subject_id: c.text(),
			client_id: c.text(),
			ip: c.text().nullable(),
			user_agent: c.text().nullable(),
			expires_at: c.text(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all sessions.
	 * @param db - Database instance
	 * @returns Array of all session records
	 */
	static list(db: Database) {
		return db.findMany(Session.table);
	}

	/**
	 * Returns the count of all sessions.
	 * Currently loads all records due to ORM limitations.
	 * @param db - Database instance
	 * @returns Total number of sessions
	 */
	static async count(db: Database): Promise<number> {
		return await db.count(Session.table);
	}

	/**
	 * Returns the count of active (non-expired) sessions.
	 * @param db - Database instance
	 * @returns Number of active sessions
	 */
	static async countActive(db: Database): Promise<number> {
		let sessions = await db.findMany(Session.table);
		let now = new Date().toISOString();
		return sessions.filter((s) => s.expires_at > now).length;
	}

	/**
	 * Returns the count of unique subjects with active sessions
	 * updated within the last 30 days (monthly active users).
	 * @param db - Database instance
	 * @returns Number of monthly active users
	 */
	static async countMonthlyActiveUsers(db: Database): Promise<number> {
		let sessions = await db.findMany(Session.table);
		let now = new Date();
		let thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
		let nowStr = now.toISOString();

		let activeSubjectIds = new Set(
			sessions
				.filter((s) => s.expires_at > nowStr && s.updated_at > thirtyDaysAgo)
				.map((s) => s.subject_id),
		);
		return activeSubjectIds.size;
	}

	/**
	 * Retrieves a single session by ID.
	 * @param db - Database instance
	 * @param id - Session ID
	 * @returns Session record or null if not found
	 */
	static show(db: Database, id: string) {
		return db.findOne(Session.table, { where: { id } });
	}

	/**
	 * Lists all sessions for a specific subject.
	 * @param db - Database instance
	 * @param subjectId - Subject ID
	 * @returns Array of session records
	 */
	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Session.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Creates a new session with a 30-day expiration.
	 * @param db - Database instance
	 * @param data - Session data including subject, client, and optional metadata
	 * @returns The generated session ID
	 */
	static async create(
		db: Database,
		data: {
			subjectId: string;
			clientId: string;
			ip?: string | null;
			userAgent?: string | null;
		},
	) {
		let id = crypto.randomUUID();
		let now = new Date();
		let expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

		await db.create(Session.table, {
			id,
			subject_id: data.subjectId,
			client_id: data.clientId,
			ip: data.ip ?? null,
			user_agent: data.userAgent ?? null,
			expires_at: expiresAt.toISOString(),
			created_at: now.toISOString(),
			updated_at: now.toISOString(),
		});

		return id;
	}

	/**
	 * Updates the session's last activity timestamp.
	 * @param db - Database instance
	 * @param id - Session ID
	 * @returns Updated session record
	 * @throws {RecordNotFoundError} If session does not exist
	 */
	static async touch(db: Database, id: string) {
		let session = await db.findOne(Session.table, { where: { id } });
		if (!session) throw new RecordNotFoundError(Session.table, { id });

		return await db.update(
			Session.table,
			{ id },
			{
				updated_at: new Date().toISOString(),
			},
		);
	}

	/**
	 * Deletes a session.
	 * @param db - Database instance
	 * @param id - Session ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If session does not exist
	 */
	static async destroy(db: Database, id: string) {
		let session = await db.findOne(Session.table, { where: { id } });
		if (!session) throw new RecordNotFoundError(Session.table, { id });
		return await db.delete(Session.table, { id });
	}

	/**
	 * Deletes all sessions for a specific subject.
	 * @param db - Database instance
	 * @param subjectId - Subject ID
	 * @returns Number of sessions deleted
	 */
	static async destroyBySubject(db: Database, subjectId: string) {
		let sessions = await db.findMany(Session.table, { where: { subject_id: subjectId } });

		if (sessions.length === 0) return 0;

		await Promise.all(sessions.map((session) => db.delete(Session.table, { id: session.id })));

		return sessions.length;
	}

	/**
	 * Removes all expired sessions from the database.
	 * @param db - Database instance
	 * @param now - Current timestamp in milliseconds
	 * @returns Number of expired sessions deleted
	 */
	static async cleanupExpired(db: Database, now: number) {
		let cutoffDate = new Date(now).toISOString();
		let sessions = await db.findMany(Session.table);
		let expiredIds = sessions.filter((s) => s.expires_at < cutoffDate).map((s) => s.id);

		if (expiredIds.length === 0) return 0;

		await Promise.all(expiredIds.map((id) => db.delete(Session.table, { id })));

		return expiredIds.length;
	}
}
