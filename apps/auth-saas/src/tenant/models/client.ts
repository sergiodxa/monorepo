import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

// Allowed schemes for logo URLs to prevent XSS attacks
const ALLOWED_LOGO_SCHEMES = ["https"];
// Allow HTTP for localhost in development
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

export default class Client {
	static InvalidLogoUrlError = class extends Error {
		override name = "InvalidLogoUrlError";
		constructor(message: string = "Invalid logo URL") {
			super(message);
		}
	};

	/**
	 * Validates that a logo URL is safe (HTTPS only, no dangerous schemes).
	 * HTTP is allowed for localhost addresses in development.
	 * Returns null if the URL is null/undefined.
	 * Throws InvalidLogoUrlError for invalid or unsafe URLs.
	 */
	static validateLogoUrl(url: string | null | undefined): string | null {
		if (url === null || url === undefined) return null;

		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			throw new Client.InvalidLogoUrlError("Invalid URL format");
		}

		let scheme = parsed.protocol.replace(":", "").toLowerCase();
		let hostname = parsed.hostname.toLowerCase();
		let isLocalhost = LOCALHOST_HOSTS.includes(hostname) || hostname.endsWith(".localhost");

		// Check for dangerous schemes (javascript:, data:, vbscript:, etc.)
		let dangerousSchemes = ["javascript", "data", "vbscript", "file"];
		if (dangerousSchemes.includes(scheme)) {
			throw new Client.InvalidLogoUrlError(`Dangerous scheme not allowed: ${scheme}`);
		}

		// Allow HTTP for localhost, require HTTPS for everything else
		if (isLocalhost) {
			if (!["http", "https"].includes(scheme)) {
				throw new Client.InvalidLogoUrlError(
					`Only HTTP/HTTPS allowed for localhost, got: ${scheme}`,
				);
			}
		} else {
			if (!ALLOWED_LOGO_SCHEMES.includes(scheme)) {
				throw new Client.InvalidLogoUrlError(`Only HTTPS allowed for logo URLs, got: ${scheme}`);
			}
		}

		return url;
	}
	static table = createTable({
		name: "clients",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			name: s.string(),
			description: s.nullable(s.string()),
			logo_url: s.nullable(s.string()),
			type: s.enum_(["public", "confidential", "m2m"]),
			allowed_scopes: s.nullable(s.string()),
			allowed_resources: s.nullable(s.string()),
			is_management_client: s.defaulted(s.boolean(), false),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static async list(db: Database) {
		return await db.findMany(Client.table);
	}

	static async show(db: Database, id: string) {
		return await db.findOne(Client.table, { where: { id } });
	}

	static async create(
		db: Database,
		data: {
			name: string;
			type: "public" | "confidential" | "m2m";
			description?: string;
			logoUrl?: string;
			allowedScopes?: string[];
			allowedResources?: string[];
			isManagementClient?: boolean;
		},
	) {
		let now = new Date().toISOString();

		// Validate logo URL to prevent XSS
		let validatedLogoUrl = Client.validateLogoUrl(data.logoUrl);

		return await db.create(Client.table, {
			id: crypto.randomUUID(),
			name: data.name,
			description: data.description ?? null,
			logo_url: validatedLogoUrl,
			type: data.type,
			allowed_scopes: data.allowedScopes ? JSON.stringify(data.allowedScopes) : null,
			allowed_resources: data.allowedResources ? JSON.stringify(data.allowedResources) : null,
			is_management_client: data.isManagementClient ?? false,
			created_at: now,
			updated_at: now,
		});
	}

	static async update(
		db: Database,
		id: string,
		data: {
			name?: string;
			description?: string | null;
			logoUrl?: string | null;
			type?: "public" | "confidential" | "m2m";
			allowedScopes?: string[] | null;
			allowedResources?: string[] | null;
			isManagementClient?: boolean;
		},
	) {
		let client = await db.findOne(Client.table, { where: { id } });
		if (!client) throw new RecordNotFoundError(Client.table, { id });

		// Validate logo URL if provided to prevent XSS
		let validatedLogoUrl =
			data.logoUrl !== undefined ? Client.validateLogoUrl(data.logoUrl) : client.logo_url;

		return await db.update(
			Client.table,
			{ id },
			{
				name: data.name ?? client.name,
				description: data.description !== undefined ? data.description : client.description,
				logo_url: validatedLogoUrl,
				type: data.type ?? client.type,
				allowed_scopes:
					data.allowedScopes !== undefined
						? data.allowedScopes
							? JSON.stringify(data.allowedScopes)
							: null
						: client.allowed_scopes,
				allowed_resources:
					data.allowedResources !== undefined
						? data.allowedResources
							? JSON.stringify(data.allowedResources)
							: null
						: client.allowed_resources,
				is_management_client: data.isManagementClient ?? Boolean(client.is_management_client),
				updated_at: new Date().toISOString(),
			},
		);
	}

	static async destroy(db: Database, id: string) {
		let client = await db.findOne(Client.table, { where: { id } });
		if (!client) throw new RecordNotFoundError(Client.table, { id });
		return await db.delete(Client.table, { id });
	}
}
