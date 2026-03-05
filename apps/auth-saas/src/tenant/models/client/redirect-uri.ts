import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";
import { InvalidUriError, UnsafeSchemeError, validateScheme } from "~/lib/uri-validation";

/**
 * Model for client redirect URIs.
 * Manages OAuth 2.0 redirect URIs for authorization code flows.
 */
export default class RedirectUri {
	/** Error thrown when a redirect URI is malformed. */
	static InvalidRedirectUriError = class extends InvalidUriError {
		override name = "InvalidRedirectUriError";
		constructor() {
			super("Invalid redirect URI");
		}
	};

	/** Error thrown when a redirect URI uses a forbidden or unsafe scheme. */
	static UnsafeSchemeError = class extends UnsafeSchemeError {
		override name = "UnsafeSchemeError";
		constructor(scheme: string) {
			super(scheme, "redirect URI");
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
		try {
			validateScheme(uri, { context: "redirect URI" });
		} catch (error) {
			if (error instanceof InvalidUriError) {
				throw new RedirectUri.InvalidRedirectUriError();
			}
			if (error instanceof UnsafeSchemeError) {
				let scheme = error.message.match(/scheme: (\w+)/)?.[1] ?? "unknown";
				throw new RedirectUri.UnsafeSchemeError(scheme);
			}
			throw error;
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

		let id = crypto.randomUUID();

		await db.create(RedirectUri.table, {
			id,
			client_id: clientId,
			uri,
			environment: environment ?? null,
			created_at: new Date().toISOString(),
		});

		return { id };
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
