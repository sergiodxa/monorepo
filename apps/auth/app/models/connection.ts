import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

export default class Connection {
	static async find(db: Database, provider: string, externalId: string) {
		return await db.query.connections.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.provider, provider),
					operators.eq(fields.externalId, externalId),
				);
			},
		});
	}

	static async create(db: Database, provider: string, externalId: string, subjectId: string) {
		let [connection] = await db
			.insert(schema.connections)
			.values({ provider, externalId, subjectId })
			.returning();

		if (connection) return connection;
		throw new Error(`Failed to create connection for ${subjectId}`);
	}
}
