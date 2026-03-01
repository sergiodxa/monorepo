import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Connection {
	static table = createTable({
		name: "connections",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			subjectId: s.string(),
			provider: s.string(),
			providerUserId: s.string(),
			accessToken: s.nullable(s.string()),
			refreshToken: s.nullable(s.string()),
			createdAt: s.string(),
			updatedAt: s.string(),
		},
	});

	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Connection.table, { where: { subjectId } });
	}

	static findByProvider(db: Database, provider: string, providerUserId: string) {
		return db.findOne(Connection.table, { where: { provider, providerUserId } });
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
			subjectId: data.subjectId,
			provider: data.provider,
			providerUserId: data.providerUserId,
			accessToken: data.accessToken ?? null,
			refreshToken: data.refreshToken ?? null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
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
				accessToken: data.accessToken ?? connection.accessToken,
				refreshToken: data.refreshToken ?? connection.refreshToken,
				updatedAt: new Date().toISOString(),
			},
		);
	}

	static async destroy(db: Database, id: string) {
		let connection = await db.findOne(Connection.table, { where: { id } });
		if (!connection) throw new RecordNotFoundError(Connection.table, { id });
		return await db.delete(Connection.table, { id });
	}
}

namespace Connection {}
