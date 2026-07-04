import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";

export default class Connection {
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

	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Connection.table, { where: { subject_id: subjectId } });
	}

	static findByProvider(db: Database, provider: string, providerUserId: string) {
		return db.findOne(Connection.table, { where: { provider, provider_user_id: providerUserId } });
	}

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

	static async destroy(db: Database, id: string) {
		let connection = await db.findOne(Connection.table, { where: { id } });
		if (!connection) throw new RecordNotFoundError(Connection.table, { id });
		return await db.delete(Connection.table, { id });
	}
}
