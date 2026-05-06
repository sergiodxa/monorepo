import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";
import { InvalidUriError, UnsafeSchemeError, validateScheme } from "~/lib/uri-validation";

/**
 * Model for OAuth 2.0 clients.
 * Manages client registration, configuration, and lifecycle.
 */
export default class Client {
	/** Error thrown when a logo URL is invalid or uses an unsafe scheme. */
	static InvalidLogoUrlError = class extends InvalidUriError {
		override name = "InvalidLogoUrlError";
		constructor(message: string = "Invalid logo URL") {
			super(message);
		}
	};

	/**
	 * Validates that a logo URL is safe.
	 * HTTPS is required for production URLs; HTTP is allowed for localhost.
	 * Dangerous schemes (javascript:, data:, vbscript:, file:) are rejected to prevent XSS.
	 * @param url - URL to validate
	 * @returns The validated URL or null
	 * @throws {InvalidLogoUrlError} If URL is invalid or uses an unsafe scheme
	 */
	static validateLogoUrl(url: string | null | undefined): string | null {
		if (url === null || url === undefined) return null;

		try {
			validateScheme(url, { context: "logo URL" });
		} catch (error) {
			if (error instanceof InvalidUriError || error instanceof UnsafeSchemeError) {
				throw new Client.InvalidLogoUrlError(error.message);
			}
			throw error;
		}

		return url;
	}

	/** Database table schema for clients. */
	static table = table({
		name: "clients",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			name: c.text(),
			description: c.text().nullable(),
			logo_url: c.text().nullable(),
			type: c.enum(["public", "confidential", "m2m"]),
			allowed_scopes: c.text().nullable(),
			allowed_resources: c.text().nullable(),
			is_management_client: c.boolean().default(false),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all clients.
	 * @param db - Database instance
	 * @returns Array of all client records
	 */
	static async list(db: Database) {
		return await db.findMany(Client.table);
	}

	/**
	 * Returns the count of all clients.
	 * Currently loads all records due to ORM limitations.
	 * @param db - Database instance
	 * @returns Total number of clients
	 */
	static async count(db: Database): Promise<number> {
		return await db.count(Client.table);
	}

	/**
	 * Fetches multiple clients by their IDs.
	 * Useful for avoiding N+1 queries when enriching grants or sessions.
	 * @param db - Database instance
	 * @param ids - Array of client IDs to fetch
	 * @returns Array of matching client records
	 */
	static async listByIds(db: Database, ids: string[]) {
		if (ids.length === 0) return [];
		let clients = await db.findMany(Client.table);
		let idSet = new Set(ids);
		return clients.filter((client) => idSet.has(client.id));
	}

	/**
	 * Retrieves a single client by ID.
	 * @param db - Database instance
	 * @param id - Client ID
	 * @returns Client record or null if not found
	 */
	static async show(db: Database, id: string) {
		return await db.findOne(Client.table, { where: { id } });
	}

	/**
	 * Creates a new client.
	 * Logo URL is validated to prevent XSS attacks.
	 * @param db - Database instance
	 * @param data - Client configuration
	 * @returns Created client record
	 * @throws {InvalidLogoUrlError} If logo URL uses an unsafe scheme
	 */
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
		let id = crypto.randomUUID();

		let validatedLogoUrl = Client.validateLogoUrl(data.logoUrl);

		await db.create(Client.table, {
			id,
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

		return { id };
	}

	/**
	 * Updates an existing client.
	 * Logo URL is validated to prevent XSS attacks.
	 * @param db - Database instance
	 * @param id - Client ID
	 * @param data - Properties to update
	 * @returns Updated client record
	 * @throws {RecordNotFoundError} If client does not exist
	 * @throws {InvalidLogoUrlError} If logo URL uses an unsafe scheme
	 */
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

	/**
	 * Deletes a client.
	 * @param db - Database instance
	 * @param id - Client ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If client does not exist
	 */
	static async destroy(db: Database, id: string) {
		let client = await db.findOne(Client.table, { where: { id } });
		if (!client) throw new RecordNotFoundError(Client.table, { id });
		return await db.delete(Client.table, { id });
	}
}
