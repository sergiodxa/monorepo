import type { Database } from "remix/data-table";

import * as schema from "~/app/models";

export namespace User {
	/**
	 * User profile data received from the identity provider.
	 */
	export interface AuthProfile {
		subjectId: string;
		email: string;
		avatar: string;
		username: string;
		displayName: string;
	}

	/**
	 * Input used to create a new user record.
	 * Includes required profile fields and optional persisted values.
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
	 * Input used to update an existing user record.
	 * All fields are optional and only provided values are applied.
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

export class User {
	static table = schema.users;

	/**
	 * Finds all users from the users table.
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
	 * Finds a user by its unique id.
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
	 * Finds a user by email address.
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
	 * Finds a user by identity-provider subject id.
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
	 * Creates a new user with defaults for missing persisted values.
	 * Returns the stored user after creation.
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
	 * Updates an existing user, keeping current values for omitted fields.
	 * Returns null when the user does not exist.
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
	 * Finds or creates a user from an auth-provider profile.
	 * Existing users are matched by subject id first, then by email.
	 *
	 * @param db Database client used to run operations.
	 * @param profile Auth-provider profile payload.
	 * @returns The linked or created user.
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

	private static get timestamp() {
		return new Date().toISOString();
	}
}
