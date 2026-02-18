import { count, eq } from "drizzle-orm";

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

	static async findAll(db: Database, options: { limit: number; offset: number }) {
		return db.query.clients.findMany({
			limit: options.limit,
			offset: options.offset,
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});
	}

	static async count(db: Database) {
		let [result] = await db.select({ count: count() }).from(schema.clients);
		return result?.count ?? 0;
	}

	static async create(
		db: Database,
		input: {
			name: string;
			description?: string | null;
			logoUrl?: string | null;
			redirectUri: string;
			logoutUri: string;
		},
	) {
		let secret = crypto.randomUUID();
		let [client] = await db
			.insert(schema.clients)
			.values({ ...input, secret })
			.returning();

		if (client) return { ...client, secret };
		throw new Error("Failed to create client");
	}

	static async update(
		db: Database,
		id: string,
		input: {
			name?: string;
			description?: string | null;
			logoUrl?: string | null;
			redirectUri?: string;
			logoutUri?: string;
			regenerateSecret?: boolean;
		},
	) {
		let { regenerateSecret, ...data } = input;
		let newSecret: string | undefined;

		if (regenerateSecret) {
			newSecret = crypto.randomUUID();
		}

		let [client] = await db
			.update(schema.clients)
			.set({ ...data, ...(newSecret ? { secret: newSecret } : {}) })
			.where(eq(schema.clients.id, id))
			.returning();

		if (client) return { ...client, newSecret };
		throw new Error(`Failed to update client with id ${id}`);
	}

	static async delete(db: Database, id: string) {
		return db.delete(schema.clients).where(eq(schema.clients.id, id));
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
