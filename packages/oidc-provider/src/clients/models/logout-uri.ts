/**
 * Model for a client's registered logout URIs.
 *
 * Stores post-logout redirect, back-channel, and front-channel logout endpoints
 * per client, validating each URI's scheme on creation and letting the logout flow
 * look them up by type.
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
	validateScheme as baseValidateScheme,
} from "../../shared/lib/uri-validation";

/**
 * Model for client logout URIs.
 * Manages post-logout redirect, backchannel, and frontchannel logout endpoints.
 */
export default class LogoutUri {
	/** Error thrown when a logout URI is malformed. */
	static InvalidLogoutUriError = class extends InvalidUriError {
		override name = "InvalidLogoutUriError";
		/** Builds the error with a fixed "Invalid logout URI" message. */
		constructor() {
			super("Invalid logout URI");
		}
	};

	/** Error thrown when a logout URI uses a forbidden or unsafe scheme. */
	static UnsafeSchemeError = class extends UnsafeSchemeError {
		override name = "UnsafeSchemeError";
		/** @param scheme - The offending URI scheme. */
		constructor(scheme: string) {
			super(scheme, "logout URI");
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
		try {
			baseValidateScheme(uri, { context: "logout URI" });
		} catch (error) {
			if (error instanceof InvalidUriError) {
				throw new LogoutUri.InvalidLogoutUriError();
			}
			if (error instanceof UnsafeSchemeError) {
				let scheme = error.message.match(/scheme: (\w+)/)?.[1] ?? "unknown";
				throw new LogoutUri.UnsafeSchemeError(scheme);
			}
			throw error;
		}
	}

	/** Database table schema for logout URIs. */
	static table = table({
		name: "client_logout_uris",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			client_id: c.text(),
			uri: c.text(),
			type: c.enum(["post_logout", "backchannel", "frontchannel"]),
			session_required: c.boolean().default(false),
			environment: c.text().nullable(),
			created_at: c.text(),
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
	 * @example
	 * let endpoints = await LogoutUri.findByType(db, clientId, "backchannel");
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
