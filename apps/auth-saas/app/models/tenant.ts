/**
 * Core data model for tenants (the top-level accounts of the SaaS). Wraps the `tenants`
 * D1 table and provides access-resolution helpers that combine ownership, pending
 * ownership, and team membership into a single role, plus slug generation and cache
 * invalidation when a tenant is suspended or deleted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "~/app/lib/db-errors";
import Hostname from "~/app/models/hostname";
import { TenantApiService } from "~/app/services/tenant-api";

import type { TenantMemberRole } from "./tenant-member";

/** A tenant row augmented with the current user's resolved role/access level. */
export interface TenantWithRole {
	id: string;
	name: string;
	slug: string;
	owner_subject_id: string;
	region: "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
	status: "active" | "suspended" | "deleted";
	/** Whether this tenant is an internal (non-billed) tenant. */
	internal: boolean;
	created_at: string;
	updated_at: string;
	/** The user's role: owner, admin, or viewer. */
	role: "owner" | TenantMemberRole;
}

/**
 * Active-record–style model for tenants, exposing static query and mutation helpers
 * over the `tenants` table plus access-resolution logic across owners and members.
 *
 * @example
 * let tenant = await Tenant.showWithAccess(db, id, subjectId, email);
 */
export default class Tenant {
	/** The `tenants` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "tenants",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			name: c.text(),
			slug: c.text(),
			owner_subject_id: c.text(),
			region: c.enum(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
			status: c.enum(["active", "suspended", "deleted"]),
			internal: c.boolean().default(false),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists every tenant in the platform (administrative listing).
	 *
	 * @param db - Database connection.
	 * @returns A promise resolving to all tenant rows.
	 */
	static list(db: Database) {
		return db.findMany(Tenant.table);
	}

	/**
	 * Lists the tenants directly owned by a subject.
	 *
	 * @param db - Database connection.
	 * @param ownerSubjectId - The owner's subject ID.
	 * @returns A promise resolving to the tenant rows owned by that subject.
	 */
	static listByOwner(db: Database, ownerSubjectId: string) {
		return db.findMany(Tenant.table, { where: { owner_subject_id: ownerSubjectId } });
	}

	/**
	 * Lists all tenants accessible to a subject (as owner or member).
	 * Returns tenants with the user's role attached.
	 * @param db - Database connection.
	 * @param subjectId - The subject ID.
	 * @param email - The subject's email (for pending owner resolution).
	 * @returns A promise resolving to accessible tenants, each with the resolved role.
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
			results.push({ ...tenant, role: "owner" } as TenantWithRole);
		}

		for (let tenant of pendingOwnedTenants) {
			results.push({ ...tenant, role: "owner" } as TenantWithRole);
		}

		for (let tenant of memberTenants) {
			if (!tenant) continue;
			// Skip if already included as owner
			if (results.some((t) => t.id === tenant.id)) continue;
			let membership = memberships.find((m) => m.tenant_id === tenant.id);
			if (!membership) continue;
			results.push({ ...tenant, role: membership.role } as TenantWithRole);
		}

		return results;
	}

	/**
	 * Finds a tenant by its primary-key id.
	 *
	 * @param db - Database connection.
	 * @param id - The tenant ID.
	 * @returns A promise resolving to the tenant row, or null when not found.
	 */
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
	 * @returns A promise resolving to the tenant with its role, or null when the tenant
	 * is missing or the subject has no access.
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
			return { ...tenant, role: "owner" } as TenantWithRole;
		}

		// Check if pending owner
		if (tenant.owner_subject_id === `pending:${email}`) {
			return { ...tenant, role: "owner" } as TenantWithRole;
		}

		// Check if member
		let TenantMember = (await import("./tenant-member")).default;
		let membership = await TenantMember.findByTenantAndSubject(db, id, subjectId);
		if (membership) {
			return { ...tenant, role: membership.role } as TenantWithRole;
		}

		return null;
	}

	/**
	 * Finds a tenant by its unique slug.
	 *
	 * @param db - Database connection.
	 * @param slug - The tenant slug to look up.
	 * @returns A promise resolving to the tenant row, or null when not found.
	 */
	static findBySlug(db: Database, slug: string) {
		return db.findOne(Tenant.table, { where: { slug } });
	}

	/**
	 * Creates a new active tenant.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant attributes (name, slug, owner, region, internal flag).
	 * @returns A promise resolving to the newly-created tenant row.
	 */
	static async create(
		db: Database,
		data: {
			name: string;
			slug: string;
			ownerSubjectId: string;
			region: "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
			/** Internal tenants skip Polar billing (default false). */
			internal?: boolean;
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
			internal: data.internal ?? false,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Tenant.table, { where: { id } }))!;
	}

	/**
	 * Updates a tenant's name and/or status. A status change also propagates the
	 * tenant-runtime entitlement gate: suspending or deleting pushes the suspension flag
	 * into the tenant Durable Object and invalidates its hostname resolution cache so its
	 * domains stop routing to it and its provider surface stops serving; reactivating
	 * clears the flag. Cache/DO propagation failures are swallowed so a control-plane
	 * status write is never lost — the DO's short cache TTL and re-checks bound staleness.
	 *
	 * @param db - Database connection.
	 * @param id - The tenant ID to update.
	 * @param data - The fields to change (name and/or status).
	 * @returns A promise resolving to the updated tenant row.
	 * @throws {RecordNotFoundError} When no tenant exists for the given id.
	 */
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

		// Suspending or deleting a tenant must stop its hostnames from routing to it and
		// stop the tenant DO from serving its provider surface.
		if (data.status === "suspended" || data.status === "deleted") {
			await Hostname.invalidateTenantCache(db, id);
			await Tenant.pushSuspension(id, true);
		} else if (data.status === "active" && tenant.status !== "active") {
			// Reactivating a previously non-active tenant lifts the runtime gate.
			await Tenant.pushSuspension(id, false);
		}

		return (await db.findOne(Tenant.table, { where: { id } }))!;
	}

	/**
	 * Pushes the tenant-runtime suspension flag into the tenant Durable Object, tolerating
	 * failures so a control-plane status change is never lost when the DO is unreachable.
	 *
	 * @param id - The tenant ID whose Durable Object to update.
	 * @param suspended - `true` to suspend the tenant's provider surface, `false` to restore it.
	 * @returns A promise that resolves once the flag is pushed (or the failure is swallowed).
	 */
	private static async pushSuspension(id: string, suspended: boolean): Promise<void> {
		try {
			await new TenantApiService(id).setSuspended(suspended);
		} catch {
			// Best-effort: the control-plane status is the source of truth and other paths
			// (hostname cache invalidation, subscription gate) still block dashboard access.
		}
	}

	/**
	 * Permanently deletes a tenant and invalidates its hostname resolution cache.
	 *
	 * @param db - Database connection.
	 * @param id - The tenant ID to delete.
	 * @returns A promise resolving to the D1 delete result.
	 * @throws {RecordNotFoundError} When no tenant exists for the given id.
	 */
	static async destroy(db: Database, id: string) {
		let tenant = await db.findOne(Tenant.table, { where: { id } });
		if (!tenant) throw new RecordNotFoundError(Tenant.table, { id });
		await Hostname.invalidateTenantCache(db, id);
		return await db.delete(Tenant.table, { id });
	}

	/**
	 * Resolves pending ownership for a tenant.
	 * Called when a user with pending ownership logs in for the first time.
	 * @param db - Database connection.
	 * @param email - The email to resolve pending ownership for.
	 * @param subjectId - The actual subject ID to assign.
	 * @returns A promise resolving to the number of tenants whose ownership was resolved.
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

	/**
	 * Generates a URL-safe, unique-ish slug from a tenant name by lowercasing,
	 * replacing non-alphanumerics with hyphens, trimming, and appending random chars.
	 *
	 * @param name - The tenant display name to derive a slug from.
	 * @returns A slug of the form `some-name-ab12`.
	 * @example
	 * let slug = Tenant.generateSlug("Acme, Inc."); // e.g. "acme-inc-4f9a"
	 */
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
