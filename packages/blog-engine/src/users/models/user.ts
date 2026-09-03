/**
 * Local user persistence: the {@link User} repository handling role assignment, OIDC
 * profile reconciliation (first-admin bootstrap and the admin allowlist), and the
 * last-admin invariant that keeps at least one administrator at all times.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import type { SelectUser } from "../../database/schema.js";

import { users } from "../../database/schema.js";
import { Role } from "../../roles/models/role.js";

/** Normalized profile fields from the OIDC provider. */
export interface AuthProfile {
	subjectId: string;
	email: string;
	avatar: string;
	username: string;
	displayName: string;
}

/**
 * Fields for creating a user. Unset optional fields fall back to generated
 * defaults: a random id, the email's local part as username, and empty
 * display name and avatar.
 */
export interface CreateUserInput {
	id?: string;
	subjectId?: string;
	email: string;
	roleId: string;
	username?: string;
	displayName?: string;
	avatar?: string;
}

/** Repository for local users, role assignment, and the last-admin invariant. */
export class User {
	/** Table reference shared by all queries. */
	static table = users;

	/** Thrown when a user mutation violates an invariant. */
	static InvalidError = class extends Error {
		constructor(message: string) {
			super(message);
			this.name = "UserInvalidError";
		}
	};

	/**
	 * Lists all users.
	 * @param db - Database handle.
	 * @returns Every user row.
	 */
	static findAll(db: Database): Promise<SelectUser[]> {
		return db.findMany(this.table);
	}

	/**
	 * Finds a user by id.
	 * @param db - Database handle.
	 * @param id - The user id.
	 * @returns The user row, or `null` when not found.
	 */
	static findById(db: Database, id: string): Promise<SelectUser | null> {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Finds a user by their OIDC subject id.
	 * @param db - Database handle.
	 * @param subjectId - The OIDC `sub` claim.
	 * @returns The user row, or `null` when not found.
	 */
	static findBySubjectId(db: Database, subjectId: string): Promise<SelectUser | null> {
		return db.findOne(this.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Finds a user by email.
	 * @param db - Database handle.
	 * @param email - The user's email address.
	 * @returns The user row, or `null` when not found.
	 */
	static findByEmail(db: Database, email: string): Promise<SelectUser | null> {
		return db.findOne(this.table, { where: { email } });
	}

	/**
	 * Creates a user and reads it back.
	 * @param db - Database handle.
	 * @param input - The user to create (id defaults to a random UUID).
	 * @returns The created user row.
	 * @throws {User.InvalidError} If the read-back fails.
	 */
	static async create(db: Database, input: CreateUserInput): Promise<SelectUser> {
		let now = new Date().toISOString();
		let id = input.id ?? crypto.randomUUID();
		await db.create(this.table, {
			id,
			subject_id: input.subjectId ?? null,
			email: input.email,
			role_id: input.roleId,
			username: input.username ?? input.email.split("@")[0] ?? "",
			display_name: input.displayName ?? "",
			avatar: input.avatar ?? "",
			created_at: now,
			updated_at: now,
		});
		let created = await this.findById(db, id);
		if (!created) throw new this.InvalidError("Failed to create user.");
		return created;
	}

	/**
	 * Reconciles an OIDC profile with a local user, applying first-admin bootstrap
	 * and the `admins` allowlist for brand-new users.
	 *
	 * @param db - Database handle.
	 * @param profile - OIDC profile of the user logging in.
	 * @param options.admins - Emails/subject ids always mapped to the admin role.
	 * @param options.bootstrapFirstAdmin - When `true` (default), the first user to
	 * sign in while no admin exists is made admin (self-hosted convenience). A
	 * multi-tenant host risks a stray SSO user reaching a freshly provisioned
	 * tenant before its owner and claiming admin, so pass `false` there and rely
	 * on the `admins` allow-list instead.
	 * @returns The linked or created user row.
	 * @throws {User.InvalidError} If a create/update read-back fails.
	 */
	static async findOrCreateFromAuthProfile(
		db: Database,
		profile: AuthProfile,
		options: { admins?: string[]; bootstrapFirstAdmin?: boolean } = {},
	): Promise<SelectUser> {
		let existing =
			(await this.findBySubjectId(db, profile.subjectId)) ??
			(await this.findByEmail(db, profile.email));

		if (existing) {
			await db.update(
				this.table,
				{ id: existing.id },
				{
					subject_id: profile.subjectId,
					email: profile.email,
					avatar: profile.avatar || existing.avatar,
					username: profile.username || existing.username,
					display_name: profile.displayName || existing.display_name,
					updated_at: new Date().toISOString(),
				},
			);
			let updated = await this.findById(db, existing.id);
			if (!updated) throw new this.InvalidError("Failed to update user.");
			return updated;
		}

		let admins = new Set((options.admins ?? []).map((value) => value.toLowerCase()));
		let isAllowlisted =
			admins.has(profile.email.toLowerCase()) || admins.has(profile.subjectId.toLowerCase());
		let bootstrapFirstAdmin = options.bootstrapFirstAdmin ?? true;
		let isFirstAdmin = bootstrapFirstAdmin && (await this.countAdmins(db)) === 0;
		let roleId =
			isAllowlisted || isFirstAdmin ? await Role.adminRoleId(db) : await Role.readerRoleId(db);

		return this.create(db, {
			subjectId: profile.subjectId,
			email: profile.email,
			avatar: profile.avatar,
			username: profile.username,
			displayName: profile.displayName,
			roleId,
		});
	}

	/**
	 * Counts users whose role grants admin capabilities (used for the last-admin
	 * invariant and first-admin bootstrap).
	 * @param db - Database handle.
	 * @returns The number of administrators.
	 */
	static async countAdmins(db: Database): Promise<number> {
		let roles = await Role.findAll(db);
		let adminRoleIds = new Set(
			roles.filter((role) => Role.isAdminRole(role)).map((role) => role.id),
		);
		if (adminRoleIds.size === 0) return 0;
		let allUsers = await db.findMany(this.table);
		return allUsers.filter((user) => adminRoleIds.has(user.role_id)).length;
	}

	/**
	 * Changes a user's role, enforcing the last-admin invariant: the final admin
	 * cannot be demoted.
	 * @param db - Database handle.
	 * @param userId - The user whose role changes.
	 * @param roleId - The target role id.
	 * @returns The updated user row.
	 * @throws {User.InvalidError} When the user/role is missing or the last admin would be demoted.
	 */
	static async changeRole(db: Database, userId: string, roleId: string): Promise<SelectUser> {
		let user = await this.findById(db, userId);
		if (!user) throw new this.InvalidError("User not found.");
		let targetRole = await Role.findById(db, roleId);
		if (!targetRole) throw new this.InvalidError("Role not found.");

		if (user.role_id !== roleId) {
			let currentRole = await Role.findById(db, user.role_id);
			let demotingAdmin = currentRole
				? Role.isAdminRole(currentRole) && !Role.isAdminRole(targetRole)
				: false;
			if (demotingAdmin && (await this.countAdmins(db)) <= 1) {
				throw new this.InvalidError("Cannot demote the last administrator.");
			}
		}

		await db.update(
			this.table,
			{ id: userId },
			{ role_id: roleId, updated_at: new Date().toISOString() },
		);
		let updated = await this.findById(db, userId);
		if (!updated) throw new this.InvalidError("Failed to update user.");
		return updated;
	}

	/**
	 * Deletes a user, enforcing the last-admin invariant. The caller must first
	 * reassign or delete the user's posts (the FK has no cascade). No-op when missing.
	 * @param db - Database handle.
	 * @param userId - The user to delete.
	 * @throws {User.InvalidError} When deleting would remove the last administrator.
	 */
	static async destroy(db: Database, userId: string): Promise<void> {
		let user = await this.findById(db, userId);
		if (!user) return;
		let role = await Role.findById(db, user.role_id);
		if (role && Role.isAdminRole(role) && (await this.countAdmins(db)) <= 1) {
			throw new this.InvalidError("Cannot delete the last administrator.");
		}
		await db.delete(this.table, { id: userId });
	}
}
