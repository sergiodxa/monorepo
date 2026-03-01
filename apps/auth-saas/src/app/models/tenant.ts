import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Tenant {
	static table = createTable({
		name: "tenants",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			name: s.string(),
			slug: s.string(),
			owner_subject_id: s.string(),
			region: s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
			status: s.enum_(["active", "suspended", "deleted"]),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static list(db: Database) {
		return db.findMany(Tenant.table);
	}

	static listByOwner(db: Database, ownerSubjectId: string) {
		return db.findMany(Tenant.table, { where: { owner_subject_id: ownerSubjectId } });
	}

	static show(db: Database, id: string) {
		return db.findOne(Tenant.table, { where: { id } });
	}

	static findBySlug(db: Database, slug: string) {
		return db.findOne(Tenant.table, { where: { slug } });
	}

	static async create(
		db: Database,
		data: {
			name: string;
			slug: string;
			ownerSubjectId: string;
			region: "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
		},
	) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();

		await db.create(Tenant.table, {
			id,
			name: data.name,
			slug: data.slug,
			owner_subject_id: data.ownerSubjectId,
			region: data.region,
			status: "active",
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Tenant.table, { where: { id } }))!;
	}

	static async update(
		db: Database,
		id: string,
		data: {
			name?: string;
			status?: "active" | "suspended" | "deleted";
		},
	) {
		let tenant = await db.findOne(Tenant.table, { where: { id } });
		if (!tenant) throw new RecordNotFoundError(Tenant.table, { id });

		await db.update(
			Tenant.table,
			{ id },
			{
				name: data.name ?? tenant.name,
				status: data.status ?? tenant.status,
				updated_at: new Date().toISOString(),
			},
		);

		return (await db.findOne(Tenant.table, { where: { id } }))!;
	}

	static async destroy(db: Database, id: string) {
		let tenant = await db.findOne(Tenant.table, { where: { id } });
		if (!tenant) throw new RecordNotFoundError(Tenant.table, { id });
		return await db.delete(Tenant.table, { id });
	}

	static generateSlug(name: string): string {
		let base = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 20);

		let random = crypto.randomUUID().slice(0, 4);
		return `${base}-${random}`;
	}
}
