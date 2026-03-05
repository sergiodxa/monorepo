import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

/** Allowed URI schemes for logout URIs. HTTP is only allowed for localhost in development. */
const ALLOWED_SCHEMES = ["https"];
const LOCALHOST_SCHEMES = ["http", "https"];
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Dangerous schemes that should never be allowed to prevent XSS attacks. */
const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];

/**
 * Model for client logout URIs.
 * Manages post-logout redirect, backchannel, and frontchannel logout endpoints.
 */
export default class LogoutUri {
	/** Error thrown when a logout URI is malformed. */
	static InvalidLogoutUriError = class extends Error {
		override name = "InvalidLogoutUriError";
	};

	/** Error thrown when a logout URI uses a forbidden or unsafe scheme. */
	static UnsafeSchemeError = class extends Error {
		override name = "UnsafeSchemeError";
		constructor(scheme: string) {
			super(`Unsafe logout URI scheme: ${scheme}. Only HTTPS is allowed (HTTP for localhost).`);
		}
	};

	/**
	 * Validates that a logout URI has a safe scheme.
	 * HTTPS is required for production; HTTP is allowed for localhost.
	 * Dangerous schemes (javascript:, data:, vbscript:, file:) are rejected to prevent XSS.
	 * @param uri - URI to validate
	 * @throws {InvalidLogoutUriError} If URI is malformed
	 * @throws {UnsafeSchemeError} If URI uses a forbidden scheme
	 */
	static validateScheme(uri: string): void {
		let parsed: URL;
		try {
			parsed = new URL(uri);
		} catch {
			throw new LogoutUri.InvalidLogoutUriError();
		}

		let scheme = parsed.protocol.replace(":", "").toLowerCase();

		if (FORBIDDEN_SCHEMES.includes(scheme)) {
			throw new LogoutUri.UnsafeSchemeError(scheme);
		}

		let hostname = parsed.hostname.toLowerCase();
		let isLocalhost = LOCALHOST_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

		if (isLocalhost) {
			if (!LOCALHOST_SCHEMES.includes(scheme)) {
				throw new LogoutUri.UnsafeSchemeError(scheme);
			}
		} else {
			if (!ALLOWED_SCHEMES.includes(scheme)) {
				throw new LogoutUri.UnsafeSchemeError(scheme);
			}
		}
	}

	/** Database table schema for logout URIs. */
	static table = createTable({
		name: "client_logout_uris",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			client_id: s.string(),
			uri: s.string(),
			type: s.enum_(["post_logout", "backchannel", "frontchannel"]),
			session_required: s.defaulted(s.boolean(), false),
			environment: s.nullable(s.string()),
			created_at: s.string(),
		},
	});

	/**
	 * Lists all logout URIs for a client.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @returns Array of logout URI records
	 */
	static async list(db: Database, clientId: string) {
		return await db.findMany(LogoutUri.table, { where: { client_id: clientId } });
	}

	/**
	 * Creates a new logout URI for a client.
	 * URI scheme is validated to prevent XSS attacks.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param data - Logout URI configuration
	 * @returns Created logout URI record
	 * @throws {InvalidLogoutUriError} If URI is malformed
	 * @throws {UnsafeSchemeError} If URI uses a forbidden scheme
	 */
	static async create(
		db: Database,
		clientId: string,
		data: {
			uri: string;
			type: "post_logout" | "backchannel" | "frontchannel";
			sessionRequired?: boolean;
			environment?: string;
		},
	) {
		LogoutUri.validateScheme(data.uri);

		let id = crypto.randomUUID();

		await db.create(LogoutUri.table, {
			id,
			client_id: clientId,
			uri: data.uri,
			type: data.type,
			session_required: data.sessionRequired ?? false,
			environment: data.environment ?? null,
			created_at: new Date().toISOString(),
		});

		return { id };
	}

	/**
	 * Deletes a logout URI.
	 * @param db - Database instance
	 * @param id - Logout URI ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If logout URI does not exist
	 */
	static async destroy(db: Database, id: string) {
		let logoutUri = await db.findOne(LogoutUri.table, { where: { id } });
		if (!logoutUri) throw new RecordNotFoundError(LogoutUri.table, { id });
		return await db.delete(LogoutUri.table, { id });
	}

	/**
	 * Finds logout URIs by type for a specific client.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param type - Logout URI type
	 * @returns Array of matching logout URI records
	 */
	static async findByType(
		db: Database,
		clientId: string,
		type: "post_logout" | "backchannel" | "frontchannel",
	) {
		return await db.findMany(LogoutUri.table, {
			where: { client_id: clientId, type },
		});
	}
}
