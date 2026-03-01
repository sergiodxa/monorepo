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
			logoUrl: s.nullable(s.string()),
			type: s.enum_(["public", "confidential", "m2m"]),
			allowedScopes: s.nullable(s.string()),
			allowedResources: s.nullable(s.string()),
			isManagementClient: s.defaulted(s.boolean(), false),
			createdAt: s.string(),
			updatedAt: s.string(),
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
			logoUrl: data.logoUrl ?? null,
			type: data.type,
			allowedScopes: data.allowedScopes ? JSON.stringify(data.allowedScopes) : null,
			allowedResources: data.allowedResources ? JSON.stringify(data.allowedResources) : null,
			isManagementClient: data.isManagementClient ?? false,
			createdAt: now,
			updatedAt: now,
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
			logoUrl: data.logoUrl !== undefined ? data.logoUrl : client.logoUrl,
			type: data.type ?? client.type,
			allowedScopes:
				data.allowedScopes !== undefined
					? data.allowedScopes
						? JSON.stringify(data.allowedScopes)
						: null
					: client.allowedScopes,
			allowedResources:
				data.allowedResources !== undefined
					? data.allowedResources
						? JSON.stringify(data.allowedResources)
						: null
					: client.allowedResources,
			isManagementClient: data.isManagementClient ?? client.isManagementClient,
			updatedAt: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: PrimaryKeyInput<typeof Client.table>) {
		let client = await db.findOne(Client.table, { where: { id } });
		if (!client) throw new RecordNotFoundError(Client.table, id);
		return await db.delete(Client.table, id);
	}
}

namespace Client {}
