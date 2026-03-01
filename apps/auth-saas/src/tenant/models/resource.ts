import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Resource {
	static table = createTable({
		name: "resources",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			identifier: s.string(),
			name: s.string(),
			description: s.nullable(s.string()),
			scopes: s.string(),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static list(db: Database) {
		return db.findMany(Resource.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(Resource.table, { where: { id } });
	}

	static findByIdentifier(db: Database, identifier: string) {
		return db.findOne(Resource.table, { where: { identifier } });
	}

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

		return await db.create(Resource.table, {
			id: crypto.randomUUID(),
			identifier: data.identifier,
			name: data.name,
			description: data.description ?? null,
			scopes: JSON.stringify(data.scopes),
			created_at: now,
			updated_at: now,
		});
	}

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

	static async destroy(db: Database, id: string) {
		let resource = await db.findOne(Resource.table, { where: { id } });
		if (!resource) throw new RecordNotFoundError(Resource.table, { id });
		return await db.delete(Resource.table, { id });
	}

	static parseScopes(resource: { scopes: string }): Array<{ name: string; description?: string }> {
		return JSON.parse(resource.scopes) as Array<{ name: string; description?: string }>;
	}
}
