import type { Database } from "~/db/index";

import { AUTH_SERVER_CLIENT_ID, AUTH_SERVER_NAME } from "~/config";
import * as schema from "~/db/schema";

export default class Client {
	static async findById(db: Database, id: string) {
		return await db.query.clients.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id);
			},
		});
	}

	static async ensureAuthServerClient(db: Database) {
		let existing = await Client.findById(db, AUTH_SERVER_CLIENT_ID);
		if (existing) return existing;

		let [client] = await db
			.insert(schema.clients)
			.values({
				id: AUTH_SERVER_CLIENT_ID,
				name: AUTH_SERVER_NAME,
				secret: "not-used-for-standalone-login",
				redirectUri: "https://auth.sergiodxa.com/sessions",
				logoutUri: "https://auth.sergiodxa.com/authorize",
			})
			.returning();

		return client;
	}
}
