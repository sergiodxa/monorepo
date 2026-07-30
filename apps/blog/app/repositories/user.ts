/**
 * User repository for blog. Provides CRUD access to the `users` table plus
 * lookups by id, email, subject id, and username, and reconciles auth-provider
 * profiles into local accounts (create-or-update) at login time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import * as schema from "~/database/schema";

/**
 * Type-only contracts used by user repository operations.
 *
 * Keeps auth-provider payloads and write-input shapes separate from persisted rows.
 */
export namespace User {
	/**
	 * Normalized profile fields required from the auth provider.
	 *
	 * `subjectId` is the stable external identifier used to link future logins.
	 */
	export interface AuthProfile {
		subjectId: string;
		email: string;
		avatar: string;
		username: string;
		displayName: string;
	}

	/**
	 * Input accepted by `User.create`.
	 *
	 * Optional persistence fields allow imports/backfills to preserve upstream identifiers
	 * and timestamps instead of generating defaults.
	 *
	 * @example
	 * let input: User.CreateInput = {
	 * 	email: "jane@example.com",
	 * 	avatar: "https://example.com/avatar.jpg",
	 * 	username: "jane",
	 * 	displayName: "Jane Doe",
	 * };
	 */
	export interface CreateInput {
		id?: string;
		subjectId?: string;
		role?: schema.SelectUser["role"];
		email: string;
		avatar: string;
		username: string;
		displayName: string;
		createdAt?: string;
		updatedAt?: string;
	}

	/**
	 * Input accepted by `User.update`.
	 *
	 * Every field is optional; omitted fields keep their current stored value.
	 *
	 * @example
	 * let input: User.UpdateInput = {
	 * 	displayName: "Jane",
	 * 	avatar: "https://example.com/new-avatar.jpg",
	 * };
	 */
	export interface UpdateInput {
		subjectId?: string;
		role?: schema.SelectUser["role"];
		email?: string;
		avatar?: string;
		username?: string;
		displayName?: string;
		updatedAt?: string;
	}
}

/**
 * Repository for reads/writes against the `users` table.
 *
 * Exposes lookup helpers plus auth-profile reconciliation used at login time.
 */
export class User {
	/**
	 * Table descriptor consumed by the `Database` client.
	 *
	 * Centralizing this reference keeps query calls consistent across methods.
	 */
	static table = schema.users;

	/**
	 * Fetches all user rows without additional filtering.
	 *
	 * Intended for administrative or internal listing flows.
	 *
	 * @param db Database client used to run operations.
	 * @returns All user records.
	 * @example
	 * let users = await User.findAll(db);
	 */
	static findAll(db: Database) {
		return db.findMany(this.table);
	}

	/**
	 * Finds a user by primary key.
	 *
	 * Returns `null` when no row exists for the provided id.
	 *
	 * @param db Database client used to run operations.
	 * @param id User id to look up.
	 * @returns The matching user or null.
	 * @example
	 * let user = await User.findById(db, "user_123");
	 */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Finds a user by unique email address.
	 *
	 * Returns `null` when the email is not present.
	 *
	 * @param db Database client used to run operations.
	 * @param email Email address to look up.
	 * @returns The matching user or null.
	 * @example
	 * let user = await User.findByEmail(db, "jane@example.com");
	 */
	static findByEmail(db: Database, email: string) {
		return db.findOne(this.table, { where: { email } });
	}

	/**
	 * Finds a user by external auth subject id.
	 *
	 * This is the preferred lookup for returning users after authentication.
	 *
	 * @param db Database client used to run operations.
	 * @param subjectId Subject id to look up.
	 * @returns The matching user or null.
	 */
	static findBySubjectId(db: Database, subjectId: string) {
		return db.findOne(this.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Finds a user by username.
	 *
	 * Returns `null` when the username does not exist.
	 *
	 * @param db Database client used to run operations.
	 * @param username Username to look up.
	 * @returns The matching user or null.
	 * @example
	 * let user = await User.findByUsername(db, "jane");
	 */
	static findByUsername(db: Database, username: string) {
		return db.findOne(this.table, { where: { username } });
	}

	/**
	 * Creates a user row from application-level input.
	 *
	 * Generates `id` and timestamps when missing, then re-reads the inserted row so
	 * callers receive the persisted record shape.
	 *
	 * @param db Database client used to run operations.
	 * @param input User fields used to create the record.
	 * @returns The created user.
	 * @example
	 * let user = await User.create(db, {
	 * 	email: "jane@example.com",
	 * 	avatar: "https://example.com/avatar.jpg",
	 * 	username: "jane",
	 * 	displayName: "Jane Doe",
	 * });
	 */
	static async create(db: Database, input: User.CreateInput) {
		let now = this.timestamp;
		let id = input.id ?? crypto.randomUUID();

		await db.create(this.table, {
			id,
			subject_id: input.subjectId,
			role: input.role ?? "guest",
			email: input.email,
			avatar: input.avatar,
			username: input.username,
			display_name: input.displayName,
			created_at: input.createdAt ?? now,
			updated_at: input.updatedAt ?? now,
		});

		return this.findById(db, id);
	}

	/**
	 * Updates a user by id using partial input.
	 *
	 * Performs a read-before-write to preserve existing values for omitted fields and
	 * returns `null` when the target user does not exist.
	 *
	 * @param db Database client used to run operations.
	 * @param id User id to update.
	 * @param input Fields to update.
	 * @returns The updated user or null.
	 * @example
	 * let user = await User.update(db, "user_123", {
	 * 	displayName: "Jane",
	 * });
	 */
	static async update(db: Database, id: string, input: User.UpdateInput) {
		let existing = await this.findById(db, id);
		if (!existing) return null;

		await db.update(this.table, id, {
			subject_id: input.subjectId ?? existing.subject_id,
			role: input.role ?? existing.role,
			email: input.email ?? existing.email,
			avatar: input.avatar ?? existing.avatar,
			username: input.username ?? existing.username,
			display_name: input.displayName ?? existing.display_name,
			updated_at: input.updatedAt ?? this.timestamp,
		});

		return this.findById(db, id);
	}

	/**
	 * Deletes a user by id.
	 *
	 * Returns `true` after `db.delete` resolves; existence is not checked first.
	 *
	 * @param db Database client used to run operations.
	 * @param id User id to delete.
	 * @returns True when deletion completes.
	 * @example
	 * let deleted = await User.destroy(db, "user_123");
	 */
	static async destroy(db: Database, id: string) {
		await db.delete(this.table, id);
		return true;
	}

	/**
	 * Reconciles an auth profile with a local user record.
	 *
	 * Lookup order is subject-id first, then email fallback for first-time linking.
	 * Creates when no match exists, otherwise updates profile-driven fields.
	 *
	 * @param db Database client used to run operations.
	 * @param profile Auth-provider profile payload.
	 * @returns The linked or created user.
	 * @throws {Error} When the follow-up read after create/update returns null.
	 */
	static async findOrCreateFromAuthProfile(db: Database, profile: User.AuthProfile) {
		let existing = await this.findBySubjectId(db, profile.subjectId);
		if (!existing) existing = await this.findByEmail(db, profile.email);

		if (!existing) {
			let created = await this.create(db, {
				subjectId: profile.subjectId,
				role: "guest",
				email: profile.email,
				avatar: profile.avatar,
				username: profile.username,
				displayName: profile.displayName,
			});

			if (!created) {
				throw new Error("Failed to create user from auth profile");
			}

			return created;
		}

		let updated = await this.update(db, existing.id, {
			subjectId: profile.subjectId,
			email: profile.email,
			avatar: profile.avatar,
			username: profile.username,
			displayName: profile.displayName,
		});

		if (!updated) {
			throw new Error("Failed to update user from auth profile");
		}

		return updated;
	}

	/**
	 * Generates an ISO-8601 UTC timestamp for persistence fields.
	 */
	private static get timestamp() {
		return new Date().toISOString();
	}
}
