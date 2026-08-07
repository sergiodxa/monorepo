/**
 * Data access for consent grants, which record that a subject authorized a client.
 * Offers find-or-create for the authorization flow, the per-subject listing the
 * account area shows with client details, a per-client count for administration, and
 * the deletions that withdraw consent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { SelectClient, SelectGrant } from "~/database/schema";

import { grantClient, grants } from "~/database/schema";

/** A grant with the client it was given to, for the account area's consent list. */
export interface GrantWithClient extends SelectGrant {
	client: SelectClient | null;
}

export default class Grant {
	/**
	 * Returns the subject's grant for a client, recording it on first consent. Callers
	 * run this on every authorization, so it must stay idempotent: the unique index on
	 * (subject, client) is what a second consent collapses into the first.
	 */
	static async findOrCreate(
		db: Database,
		subjectId: string,
		clientId: string,
	): Promise<SelectGrant> {
		let existing = await db.findOne(grants, {
			where: { subject_id: subjectId, client_id: clientId },
		});

		if (existing) return existing;

		return await db.create(
			grants,
			{ id: generateUUID(), subject_id: subjectId, client_id: clientId },
			{ touch: true, returnRow: true },
		);
	}

	/** Lists a subject's grants with their clients, oldest consent first. */
	static async findBySubjectId(db: Database, subjectId: string): Promise<GrantWithClient[]> {
		return await db.findMany(grants, {
			where: { subject_id: subjectId },
			orderBy: ["created_at", "asc"],
			with: { client: grantClient },
		});
	}

	/** How many subjects have authorized a client, for its admin detail page. */
	static async countByClientId(db: Database, clientId: string): Promise<number> {
		return await db.count(grants, { where: { client_id: clientId } });
	}

	/** Withdraws every consent a subject has given. */
	static async deleteBySubjectId(db: Database, subjectId: string): Promise<number> {
		let result = await db.deleteMany(grants, { where: { subject_id: subjectId } });
		return result.affectedRows ?? 0;
	}

	/** Withdraws every consent given to a client, as deleting the client does. */
	static async deleteByClientId(db: Database, clientId: string): Promise<number> {
		let result = await db.deleteMany(grants, { where: { client_id: clientId } });
		return result.affectedRows ?? 0;
	}

	/** Withdraws one subject's consent for one client. */
	static async deleteBySubjectAndClient(
		db: Database,
		subjectId: string,
		clientId: string,
	): Promise<number> {
		let result = await db.deleteMany(grants, {
			where: { subject_id: subjectId, client_id: clientId },
		});
		return result.affectedRows ?? 0;
	}
}
