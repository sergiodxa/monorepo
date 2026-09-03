/**
 * Data access for subjects — the people who can sign in. Covers lookup by email or
 * id, the paginated listing and counting the admin screens read, and create/update/
 * delete, so login flows and administration share one description of the table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";

import type { InsertSubject, SelectSubject } from "~/database/schema";

import { subjects } from "~/database/schema";

/** Fields a caller supplies when registering a subject; the id is generated when omitted. */
export interface CreateSubjectInput {
	id?: string;
	email_address: string;
	display_name: string;
	username: string;
	avatar: string;
	email_verified_at?: number | null;
}

export default class Subject {
	/** Finds a subject by email address, or `null` when nobody has registered it. */
	static async findByEmail(db: Database, emailAddress: string): Promise<SelectSubject | null> {
		return await db.findOne(subjects, { where: { email_address: emailAddress } });
	}

	/** Finds a subject by id, or `null` when it no longer exists. */
	static async findById(db: Database, id: string): Promise<SelectSubject | null> {
		return await db.findOne(subjects, { where: { id } });
	}

	/** Lists subjects oldest first, so a page number keeps pointing at the same people. */
	static async findAll(
		db: Database,
		options: { limit: number; offset: number },
	): Promise<SelectSubject[]> {
		return await db.findMany(subjects, {
			limit: options.limit,
			offset: options.offset,
			orderBy: ["created_at", "asc"],
		});
	}

	/** Total number of registered subjects, for the admin dashboard. */
	static async count(db: Database): Promise<number> {
		return await db.count(subjects);
	}

	/**
	 * Registers a subject. `email_verified_at` defaults to `null` because a password
	 * registration leaves the address unproven; provider logins stamp it explicitly.
	 */
	static async create(db: Database, input: CreateSubjectInput): Promise<SelectSubject> {
		return await db.create(
			subjects,
			{
				id: input.id ?? generateUUID(),
				email_address: input.email_address,
				display_name: input.display_name,
				username: input.username,
				avatar: input.avatar,
				email_verified_at: input.email_verified_at ?? null,
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Updates a subject's attributes. Throws when the subject no longer exists. */
	static async update(db: Database, id: string, input: InsertSubject): Promise<SelectSubject> {
		return await db.update(subjects, id, input, { touch: true });
	}

	/** Deletes a subject; cascades take its credentials, connections, sessions and grants. */
	static async delete(db: Database, id: string): Promise<boolean> {
		return await db.delete(subjects, id);
	}
}
