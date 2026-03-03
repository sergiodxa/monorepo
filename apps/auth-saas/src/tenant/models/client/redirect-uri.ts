import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

// Allowed URI schemes for redirect URIs
// http is only allowed for localhost in development
const ALLOWED_SCHEMES = ["https"];
const LOCALHOST_SCHEMES = ["http", "https"];
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// Dangerous schemes that should never be allowed
const FORBIDDEN_SCHEMES = ["javascript", "data", "vbscript", "file"];

export default class RedirectUri {
	static InvalidRedirectUriError = class extends Error {
		override name = "InvalidRedirectUriError";
	};

	static UnsafeSchemeError = class extends Error {
		override name = "UnsafeSchemeError";
		constructor(scheme: string) {
			super(`Unsafe redirect URI scheme: ${scheme}. Only HTTPS is allowed (HTTP for localhost).`);
		}
	};

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

	static async list(db: Database, clientId: string) {
		return await db.findMany(RedirectUri.table, { where: { client_id: clientId } });
	}

	/**
	 * Validates that a redirect URI has a safe scheme.
	 * - HTTPS is always allowed
	 * - HTTP is only allowed for localhost addresses
	 * - Dangerous schemes (javascript:, data:, etc.) are never allowed
	 */
	static validateScheme(uri: string): void {
		let parsed: URL;
		try {
			parsed = new URL(uri);
		} catch {
			throw new RedirectUri.InvalidRedirectUriError();
		}

		let scheme = parsed.protocol.replace(":", "").toLowerCase();

		// Check for explicitly forbidden schemes
		if (FORBIDDEN_SCHEMES.includes(scheme)) {
			throw new RedirectUri.UnsafeSchemeError(scheme);
		}

		// Check if it's a localhost URL
		let hostname = parsed.hostname.toLowerCase();
		let isLocalhost = LOCALHOST_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

		if (isLocalhost) {
			// Allow HTTP or HTTPS for localhost
			if (!LOCALHOST_SCHEMES.includes(scheme)) {
				throw new RedirectUri.UnsafeSchemeError(scheme);
			}
		} else {
			// Only allow HTTPS for non-localhost
			if (!ALLOWED_SCHEMES.includes(scheme)) {
				throw new RedirectUri.UnsafeSchemeError(scheme);
			}
		}
	}

	static async create(db: Database, clientId: string, uri: string, environment?: string) {
		// Validate URI scheme before creating
		RedirectUri.validateScheme(uri);

		return await db.create(RedirectUri.table, {
			id: crypto.randomUUID(),
			client_id: clientId,
			uri,
			environment: environment ?? null,
			created_at: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: string) {
		let redirectUri = await db.findOne(RedirectUri.table, { where: { id } });
		if (!redirectUri) throw new RecordNotFoundError(RedirectUri.table, { id });
		return await db.delete(RedirectUri.table, { id });
	}

	static async validate(db: Database, clientId: string, uri: string): Promise<boolean> {
		let redirectUris = await db.findMany(RedirectUri.table, {
			where: { client_id: clientId },
		});
		return redirectUris.some((redirectUri) => redirectUri.uri === uri);
	}
}
