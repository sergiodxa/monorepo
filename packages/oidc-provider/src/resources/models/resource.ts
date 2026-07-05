/**
 * Model for protected API resources (OAuth 2.0 resource servers / audiences).
 *
 * Stores each resource's audience identifier, display metadata, and the set of
 * scopes it defines (persisted as JSON), and supports lookup by id or identifier
 * plus create/update/delete and safe scope parsing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";

/** Schema validating the array of scope objects stored on a resource. */
const ScopesSchema = s.array(
	s.object({
		name: s.string(),
		description: s.optional(s.string()),
	}),
);

/**
 * Persistence model for API resources and their defined scopes.
 */
export default class Resource {
	/** Database table schema for resources. */
	static table = table({
		name: "resources",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			identifier: c.text(),
			name: c.text(),
			description: c.text().nullable(),
			scopes: c.text(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all resources.
	 * @param db - Database instance.
	 * @returns Array of all resource records.
	 */
	static list(db: Database) {
		return db.findMany(Resource.table);
	}

	/**
	 * Retrieves a single resource by ID.
	 * @param db - Database instance.
	 * @param id - Resource ID.
	 * @returns Resource record or null if not found.
	 */
	static show(db: Database, id: string) {
		return db.findOne(Resource.table, { where: { id } });
	}

	/**
	 * Finds a resource by its audience identifier.
	 * @param db - Database instance.
	 * @param identifier - The resource's audience identifier (e.g. an API URL).
	 * @returns Resource record or null if not found.
	 */
	static findByIdentifier(db: Database, identifier: string) {
		return db.findOne(Resource.table, { where: { identifier } });
	}

	/**
	 * Creates a new resource with its scopes.
	 * @param db - Database instance.
	 * @param data - Resource identifier, name, optional description, and scopes.
	 * @returns The created resource's `id`.
	 * @example
	 * let { id } = await Resource.create(db, { identifier, name, scopes: [{ name: "read" }] });
	 */
	static async create(
		db: Database,
		data: {
			identifier: string;
			name: string;
			description?: string;
			scopes: Array<{ name: string; description?: string }>;
		},
	) {
		let now = new Date().toISOString();
		let id = crypto.randomUUID();

		await db.create(Resource.table, {
			id,
			identifier: data.identifier,
			name: data.name,
			description: data.description ?? null,
			scopes: JSON.stringify(data.scopes),
			created_at: now,
			updated_at: now,
		});

		return { id };
	}

	/**
	 * Updates an existing resource; omitted fields keep their current values.
	 * @param db - Database instance.
	 * @param id - Resource ID.
	 * @param data - Fields to update (identifier, name, description, scopes).
	 * @returns The update result.
	 * @throws {RecordNotFoundError} If the resource does not exist.
	 */
	static async update(
		db: Database,
		id: string,
		data: {
			identifier?: string;
			name?: string;
			description?: string | null;
			scopes?: Array<{ name: string; description?: string }>;
		},
	) {
		let resource = await db.findOne(Resource.table, { where: { id } });
		if (!resource) throw new RecordNotFoundError(Resource.table, { id });

		return await db.update(
			Resource.table,
			{ id },
			{
				identifier: data.identifier ?? resource.identifier,
				name: data.name ?? resource.name,
				description: data.description !== undefined ? data.description : resource.description,
				scopes: data.scopes ? JSON.stringify(data.scopes) : resource.scopes,
				updated_at: new Date().toISOString(),
			},
		);
	}

	/**
	 * Deletes a resource.
	 * @param db - Database instance.
	 * @param id - Resource ID.
	 * @returns Deletion result.
	 * @throws {RecordNotFoundError} If the resource does not exist.
	 */
	static async destroy(db: Database, id: string) {
		let resource = await db.findOne(Resource.table, { where: { id } });
		if (!resource) throw new RecordNotFoundError(Resource.table, { id });
		return await db.delete(Resource.table, { id });
	}

	/**
	 * Parses a resource's stored `scopes` JSON into a validated array.
	 * Returns `[]` when the value is missing, malformed, or fails validation.
	 * @param resource - Resource record (only `scopes` is read).
	 * @returns The parsed scope objects.
	 */
	static parseScopes(resource: { scopes: string }): Array<{ name: string; description?: string }> {
		let parsed: unknown;
		try {
			parsed = JSON.parse(resource.scopes);
		} catch {
			return [];
		}

		let result = s.parseSafe(ScopesSchema, parsed);
		if (!result.success) return [];
		return result.value;
	}
}
