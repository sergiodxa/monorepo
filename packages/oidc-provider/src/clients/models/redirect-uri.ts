/**
 * Model for a client's registered OAuth 2.0 redirect URIs.
 *
 * Stores the allow-list of redirect URIs per client, validating each URI's scheme
 * on creation (HTTPS-only outside localhost) and exposing an exact-match check the
 * authorization endpoint uses to reject unregistered `redirect_uri` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";
import {
	InvalidUriError,
	UnsafeSchemeError,
	validateScheme,
} from "../../shared/lib/uri-validation";

/**
 * Model for client redirect URIs.
 * Manages OAuth 2.0 redirect URIs for authorization code flows.
 */
export default class RedirectUri {
	/** Error thrown when a redirect URI is malformed. */
	static InvalidRedirectUriError = class extends InvalidUriError {
		override name = "InvalidRedirectUriError";
		/** Builds the error with a fixed "Invalid redirect URI" message. */
		constructor() {
			super("Invalid redirect URI");
		}
	};

	/** Error thrown when a redirect URI uses a forbidden or unsafe scheme. */
	static UnsafeSchemeError = class extends UnsafeSchemeError {
		override name = "UnsafeSchemeError";
		/** @param scheme - The offending URI scheme. */
		constructor(scheme: string) {
			super(scheme, "redirect URI");
		}
	};

	/** Database table schema for redirect URIs. */
	static table = table({
		name: "client_redirect_uris",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			client_id: c.text(),
			uri: c.text(),
			environment: c.text().nullable(),
			created_at: c.text(),
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
	 * @example
	 * if (!(await RedirectUri.validate(db, clientId, redirectUri))) return reject(...);
	 */
	static async validate(db: Database, clientId: string, uri: string): Promise<boolean> {
		let result = await db.findOne(RedirectUri.table, {
			where: { client_id: clientId, uri },
		});
		return result !== null;
	}
}
