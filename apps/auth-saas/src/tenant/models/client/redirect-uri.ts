import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

/** Allowed URI schemes for redirect URIs. HTTP is only allowed for localhost in development. */
const ALLOWED_SCHEMES = ["https"];
const LOCALHOST_SCHEMES = ["http", "https"];
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Dangerous schemes that should never be allowed to prevent XSS attacks. */
const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];

/**
 * Model for client redirect URIs.
 * Manages OAuth 2.0 redirect URIs for authorization code flows.
 */
export default class RedirectUri {
	/** Error thrown when a redirect URI is malformed. */
	static InvalidRedirectUriError = class extends Error {
		override name = "InvalidRedirectUriError";
	};

	/** Error thrown when a redirect URI uses a forbidden or unsafe scheme. */
	static UnsafeSchemeError = class extends Error {
		override name = "UnsafeSchemeError";
		constructor(scheme: string) {
			super(`Unsafe redirect URI scheme: ${scheme}. Only HTTPS is allowed (HTTP for localhost).`);
		}
	};

	/** Database table schema for redirect URIs. */
	static table = createTable({
		name: "client_redirect_uris",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			client_id: s.string(),
			uri: s.string(),
			environment: s.nullable(s.string()),
			created_at: s.string(),
		},
	});

	/**
	 * Lists all redirect URIs for a client.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @returns Array of redirect URI records
	 */
	static async list(db: Database, clientId: string) {
		return await db.findMany(RedirectUri.table, { where: { client_id: clientId } });
	}

	/**
	 * Validates that a redirect URI has a safe scheme.
	 * HTTPS is required for production; HTTP is allowed for localhost.
	 * Dangerous schemes (javascript:, data:, vbscript:, file:) are rejected to prevent XSS.
	 * @param uri - URI to validate
	 * @throws {InvalidRedirectUriError} If URI is malformed
	 * @throws {UnsafeSchemeError} If URI uses a forbidden scheme
	 */
	static validateScheme(uri: string): void {
		let parsed: URL;
		try {
			parsed = new URL(uri);
		} catch {
			throw new RedirectUri.InvalidRedirectUriError();
		}

		let scheme = parsed.protocol.replace(":", "").toLowerCase();

		if (FORBIDDEN_SCHEMES.includes(scheme)) {
			throw new RedirectUri.UnsafeSchemeError(scheme);
		}

		let hostname = parsed.hostname.toLowerCase();
		let isLocalhost = LOCALHOST_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

		if (isLocalhost) {
			if (!LOCALHOST_SCHEMES.includes(scheme)) {
				throw new RedirectUri.UnsafeSchemeError(scheme);
			}
		} else {
			if (!ALLOWED_SCHEMES.includes(scheme)) {
				throw new RedirectUri.UnsafeSchemeError(scheme);
			}
		}
	}

	/**
	 * Creates a new redirect URI for a client.
	 * URI scheme is validated to prevent XSS attacks.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param uri - Redirect URI
	 * @param environment - Optional environment label
	 * @returns Created redirect URI record
	 * @throws {InvalidRedirectUriError} If URI is malformed
	 * @throws {UnsafeSchemeError} If URI uses a forbidden scheme
	 */
	static async create(db: Database, clientId: string, uri: string, environment?: string) {
		RedirectUri.validateScheme(uri);

		return await db.create(RedirectUri.table, {
			id: crypto.randomUUID(),
			client_id: clientId,
			uri,
			environment: environment ?? null,
			created_at: new Date().toISOString(),
		});
	}

	/**
	 * Deletes a redirect URI.
	 * @param db - Database instance
	 * @param id - Redirect URI ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If redirect URI does not exist
	 */
	static async destroy(db: Database, id: string) {
		let redirectUri = await db.findOne(RedirectUri.table, { where: { id } });
		if (!redirectUri) throw new RecordNotFoundError(RedirectUri.table, { id });
		return await db.delete(RedirectUri.table, { id });
	}

	/**
	 * Validates that a redirect URI is registered for a client.
	 * @param db - Database instance
	 * @param clientId - Client ID
	 * @param uri - Redirect URI to validate
	 * @returns True if the URI is registered for the client
	 */
	static async validate(db: Database, clientId: string, uri: string): Promise<boolean> {
		let result = await db.findOne(RedirectUri.table, {
			where: { client_id: clientId, uri },
		});
		return result !== null;
	}
}
