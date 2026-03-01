import type { Database, PrimaryKeyInput } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Client {
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

	static async show(db: Database, id: PrimaryKeyInput<typeof Client.table>) {
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

		return await db.create(Client.table, {
			id: crypto.randomUUID(),
			name: data.name,
			description: data.description ?? null,
			logo_url: data.logoUrl ?? null,
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
		id: PrimaryKeyInput<typeof Client.table>,
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
		if (!client) throw new RecordNotFoundError(Client.table, id);

		return await db.update(Client.table, id, {
			name: data.name ?? client.name,
			description: data.description !== undefined ? data.description : client.description,
			logo_url: data.logoUrl !== undefined ? data.logoUrl : client.logo_url,
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
			is_management_client: data.isManagementClient ?? client.is_management_client,
			updated_at: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: PrimaryKeyInput<typeof Client.table>) {
		let client = await db.findOne(Client.table, { where: { id } });
		if (!client) throw new RecordNotFoundError(Client.table, id);
		return await db.delete(Client.table, id);
	}
}
