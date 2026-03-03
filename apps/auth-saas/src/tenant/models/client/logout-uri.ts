import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

// Allowed URI schemes for logout URIs (same as redirect URIs)
// http is only allowed for localhost in development
const ALLOWED_SCHEMES = ["https"];
const LOCALHOST_SCHEMES = ["http", "https"];
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// Dangerous schemes that should never be allowed
const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];

export default class LogoutUri {
	static InvalidLogoutUriError = class extends Error {
		override name = "InvalidLogoutUriError";
	};

	static UnsafeSchemeError = class extends Error {
		override name = "UnsafeSchemeError";
		constructor(scheme: string) {
			super(`Unsafe logout URI scheme: ${scheme}. Only HTTPS is allowed (HTTP for localhost).`);
		}
	};

	/**
	 * Validates that a logout URI has a safe scheme.
	 * - HTTPS is always allowed
	 * - HTTP is only allowed for localhost addresses
	 * - Dangerous schemes (javascript:, data:, etc.) are never allowed
	 */
	static validateScheme(uri: string): void {
		let parsed: URL;
		try {
			parsed = new URL(uri);
		} catch {
			throw new LogoutUri.InvalidLogoutUriError();
		}

		let scheme = parsed.protocol.replace(":", "").toLowerCase();

		// Check for explicitly forbidden schemes
		if (FORBIDDEN_SCHEMES.includes(scheme)) {
			throw new LogoutUri.UnsafeSchemeError(scheme);
		}

		// Check if it's a localhost URL
		let hostname = parsed.hostname.toLowerCase();
		let isLocalhost = LOCALHOST_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

		if (isLocalhost) {
			// Allow HTTP or HTTPS for localhost
			if (!LOCALHOST_SCHEMES.includes(scheme)) {
				throw new LogoutUri.UnsafeSchemeError(scheme);
			}
		} else {
			// Only allow HTTPS for non-localhost
			if (!ALLOWED_SCHEMES.includes(scheme)) {
				throw new LogoutUri.UnsafeSchemeError(scheme);
			}
		}
	}
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

	static async list(db: Database, clientId: string) {
		return await db.findMany(LogoutUri.table, { where: { client_id: clientId } });
	}

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
		// Validate URI scheme before creating (prevents XSS via dangerous schemes)
		LogoutUri.validateScheme(data.uri);

		return await db.create(LogoutUri.table, {
			id: crypto.randomUUID(),
			client_id: clientId,
			uri: data.uri,
			type: data.type,
			session_required: data.sessionRequired ?? false,
			environment: data.environment ?? null,
			created_at: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: string) {
		let logoutUri = await db.findOne(LogoutUri.table, { where: { id } });
		if (!logoutUri) throw new RecordNotFoundError(LogoutUri.table, { id });
		return await db.delete(LogoutUri.table, { id });
	}

	static async findByType(
		db: Database,
		clientId: string,
		type: "post_logout" | "backchannel" | "frontchannel",
	) {
		// Filter by both client_id and type in the query for better performance
		return await db.findMany(LogoutUri.table, {
			where: { client_id: clientId, type },
		});
	}
}
