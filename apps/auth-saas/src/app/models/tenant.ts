import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

import type { TenantMemberRole } from "./tenant-member";

/** Represents the user's role/access level for a tenant. */
export interface TenantWithRole {
	id: string;
	name: string;
	slug: string;
	owner_subject_id: string;
	region: "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
	status: "active" | "suspended" | "deleted";
	created_at: string;
	updated_at: string;
	/** The user's role: owner, admin, or viewer. */
	role: "owner" | TenantMemberRole;
}

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

	/**
	 * Lists all tenants accessible to a subject (as owner or member).
	 * Returns tenants with the user's role attached.
	 * @param db - Database connection.
	 * @param subjectId - The subject ID.
	 * @param email - The subject's email (for pending owner resolution).
	 */
	static async listAccessibleBySubject(
		db: Database,
		subjectId: string,
		email: string,
	): Promise<TenantWithRole[]> {
		// Import here to avoid circular dependency
		let TenantMember = (await import("./tenant-member")).default;

		// Get tenants owned by this subject
		let ownedTenants = await db.findMany(Tenant.table, {
			where: { owner_subject_id: subjectId },
		});

		// Also check for pending ownership (platform tenant before first login)
		let pendingOwnedTenants = await db.findMany(Tenant.table, {
			where: { owner_subject_id: `pending:${email}` },
		});

		// Get memberships for this subject
		let memberships = await TenantMember.listBySubject(db, subjectId);

		// Fetch member tenants
		let memberTenantIds = memberships.map((m) => m.tenant_id);
		let memberTenants: Array<Awaited<ReturnType<typeof Tenant.show>>> = [];
		for (let tenantId of memberTenantIds) {
			let tenant = await Tenant.show(db, tenantId);
			if (tenant) memberTenants.push(tenant);
		}

		// Combine results with roles
		let results: TenantWithRole[] = [];

		for (let tenant of ownedTenants) {
			results.push({ ...tenant, role: "owner" });
		}

		for (let tenant of pendingOwnedTenants) {
			results.push({ ...tenant, role: "owner" });
		}

		for (let tenant of memberTenants) {
			if (!tenant) continue;
			// Skip if already included as owner
			if (results.some((t) => t.id === tenant.id)) continue;
			let membership = memberships.find((m) => m.tenant_id === tenant.id);
			if (!membership) continue;
			results.push({
				...tenant,
				role: membership.role,
			});
		}

		return results;
	}

	static show(db: Database, id: string) {
		return db.findOne(Tenant.table, { where: { id } });
	}

	/**
	 * Gets a tenant with the user's role if they have access.
	 * Returns null if tenant doesn't exist or user doesn't have access.
	 * @param db - Database connection.
	 * @param id - The tenant ID.
	 * @param subjectId - The subject ID.
	 * @param email - The subject's email (for pending owner resolution).
	 */
	static async showWithAccess(
		db: Database,
		id: string,
		subjectId: string,
		email: string,
	): Promise<TenantWithRole | null> {
		let tenant = await db.findOne(Tenant.table, { where: { id } });
		if (!tenant) return null;

		// Check if owner
		if (tenant.owner_subject_id === subjectId) {
			return { ...tenant, role: "owner" };
		}

		// Check if pending owner
		if (tenant.owner_subject_id === `pending:${email}`) {
			return { ...tenant, role: "owner" };
		}

		// Check if member
		let TenantMember = (await import("./tenant-member")).default;
		let membership = await TenantMember.findByTenantAndSubject(db, id, subjectId);
		if (membership) {
			return { ...tenant, role: membership.role };
		}

		return null;
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

	/**
	 * Resolves pending ownership for a tenant.
	 * Called when a user with pending ownership logs in for the first time.
	 * @param db - Database connection.
	 * @param email - The email to resolve pending ownership for.
	 * @param subjectId - The actual subject ID to assign.
	 */
	static async resolvePendingOwnership(db: Database, email: string, subjectId: string) {
		let pendingOwnerValue = `pending:${email}`;
		let pendingTenants = await db.findMany(Tenant.table, {
			where: { owner_subject_id: pendingOwnerValue },
		});

		for (let tenant of pendingTenants) {
			await db.update(
				Tenant.table,
				{ id: tenant.id },
				{
					owner_subject_id: subjectId,
					updated_at: new Date().toISOString(),
				},
			);
		}

		return pendingTenants.length;
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
