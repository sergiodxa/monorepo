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

	/**
	 * Ensures the auth server's own OAuth client exists in the
	 * database. Creates it with a randomly generated secret on first
	 * run.
	 *
	 * @param db - Database instance
	 * @param requestUrl - The current request URL (used to determine redirect URI for localhost vs prod)
	 * @returns The auth server client (including secret for token exchange)
	 */
	static async ensureAuthServerClient(db: Database, requestUrl: URL) {
		let existing = await Client.findById(db, AUTH_SERVER_CLIENT_ID);
		if (existing) return existing;

		// Determine the base URL from the request (handles localhost vs production)
		let baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

		let [client] = await db
			.insert(schema.clients)
			.values({
				id: AUTH_SERVER_CLIENT_ID,
				name: AUTH_SERVER_NAME,
				secret: crypto.randomUUID(),
				redirectUri: `${baseUrl}/auth/callback`,
				logoutUri: `${baseUrl}/authorize`,
			})
			.returning();

		if (client) return client;
		throw new Error("Failed to create auth server client");
	}
}
