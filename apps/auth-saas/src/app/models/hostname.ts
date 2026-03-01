import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Hostname {
	static table = createTable({
		name: "hostnames",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			tenant_id: s.string(),
			hostname: s.string(),
			is_default: s.defaulted(s.boolean(), false),
			status: s.enum_(["pending_validation", "active", "deleted"]),
			ssl_status: s.nullable(s.string()),
			validation_txt_name: s.nullable(s.string()),
			validation_txt_value: s.nullable(s.string()),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static listByTenant(db: Database, tenantId: string) {
		return db.findMany(Hostname.table, { where: { tenant_id: tenantId } });
	}

	static show(db: Database, id: string) {
		return db.findOne(Hostname.table, { where: { id } });
	}

	static findByHostname(db: Database, hostname: string) {
		return db.findOne(Hostname.table, { where: { hostname } });
	}

	static async createDefault(db: Database, tenantId: string, slug: string, platformDomain: string) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();
		let hostname = `${slug}.${platformDomain}`;

		await db.create(Hostname.table, {
			id,
			tenant_id: tenantId,
			hostname,
			is_default: true,
			status: "active",
			ssl_status: null,
			validation_txt_name: null,
			validation_txt_value: null,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	static async createCustom(
		db: Database,
		tenantId: string,
		hostname: string,
		validation: { txtName: string; txtValue: string },
	) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();

		await db.create(Hostname.table, {
			id,
			tenant_id: tenantId,
			hostname,
			is_default: false,
			status: "pending_validation",
			ssl_status: null,
			validation_txt_name: validation.txtName,
			validation_txt_value: validation.txtValue,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	static async activate(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });

		await db.update(
			Hostname.table,
			{ id },
			{
				status: "active",
				validation_txt_name: null,
				validation_txt_value: null,
				updated_at: new Date().toISOString(),
			},
		);

		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	static async destroy(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });
		return await db.delete(Hostname.table, { id });
	}
}
