/**
 * Model for external identity-provider connections linked to a subject.
 *
 * Records the link between a local subject and an upstream provider account
 * (e.g. a social login), optionally storing the provider's OAuth tokens, and
 * supports lookup by provider, creation, token updates, and removal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";

/**
 * Persistence model for a subject's linked external identity providers.
 */
export default class Connection {
	/** Database table schema for connections. */
	static table = table({
		name: "connections",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			subject_id: c.text(),
			provider: c.text(),
			provider_user_id: c.text(),
			access_token: c.text().nullable(),
			refresh_token: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all external connections for a subject.
	 * @param db - Database instance.
	 * @param subjectId - Subject ID to filter by.
	 * @returns Array of connection records for the subject.
	 */
	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Connection.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Finds a connection by provider and provider-side user id.
	 * @param db - Database instance.
	 * @param provider - Upstream provider identifier (e.g. `"google"`).
	 * @param providerUserId - The user's id at the provider.
	 * @returns Connection record or null if not found.
	 */
	static findByProvider(db: Database, provider: string, providerUserId: string) {
		return db.findOne(Connection.table, { where: { provider, provider_user_id: providerUserId } });
	}

	/**
	 * Creates a new external identity connection for a subject.
	 * @param db - Database instance.
	 * @param data - Provider link details and optional OAuth tokens.
	 * @returns The created connection write result.
	 */
	static async create(
		db: Database,
		data: {
			subjectId: string;
			provider: string;
			providerUserId: string;
			accessToken?: string | null;
			refreshToken?: string | null;
		},
	) {
		return await db.create(Connection.table, {
			id: crypto.randomUUID(),
			subject_id: data.subjectId,
			provider: data.provider,
			provider_user_id: data.providerUserId,
			access_token: data.accessToken ?? null,
			refresh_token: data.refreshToken ?? null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});
	}

	/**
	 * Updates the stored OAuth tokens for a connection.
	 * @param db - Database instance.
	 * @param id - Connection ID.
	 * @param data - New access and/or refresh tokens (unchanged when omitted).
	 * @returns The update result.
	 * @throws {RecordNotFoundError} If the connection does not exist.
	 */
	static async update(
		db: Database,
		id: string,
		data: {
			accessToken?: string | null;
			refreshToken?: string | null;
		},
	) {
		let connection = await db.findOne(Connection.table, { where: { id } });
		if (!connection) throw new RecordNotFoundError(Connection.table, { id });

		return await db.update(
			Connection.table,
			{ id },
			{
				access_token: data.accessToken ?? connection.access_token,
				refresh_token: data.refreshToken ?? connection.refresh_token,
				updated_at: new Date().toISOString(),
			},
		);
	}

	/**
	 * Deletes (unlinks) an external identity connection.
	 * @param db - Database instance.
	 * @param id - Connection ID.
	 * @returns Deletion result.
	 * @throws {RecordNotFoundError} If the connection does not exist.
	 */
	static async destroy(db: Database, id: string) {
		let connection = await db.findOne(Connection.table, { where: { id } });
		if (!connection) throw new RecordNotFoundError(Connection.table, { id });
		return await db.delete(Connection.table, { id });
	}
}
