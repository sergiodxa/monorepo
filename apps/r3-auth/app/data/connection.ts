/**
 * Data access for social-login connections, which tie an external provider identity
 * to a subject. Provider login resolves an identity through `find` and provisions a
 * new one through `create`, so the (provider, external id) pair is the only thing the
 * login flow has to reason about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { SelectConnection } from "~/database/schema";

import { connections } from "~/database/schema";

export default class Connection {
	/**
	 * Finds the connection for a provider identity, or `null` when the identity has
	 * never signed in here. The pair is unique, so a match names exactly one subject.
	 */
	static async find(
		db: Database,
		provider: string,
		externalId: string,
	): Promise<SelectConnection | null> {
		return await db.findOne(connections, {
			where: { provider, external_id: externalId },
		});
	}

	/** Links a provider identity to a subject, on that identity's first sign-in. */
	static async create(
		db: Database,
		provider: string,
		externalId: string,
		subjectId: string,
	): Promise<SelectConnection> {
		return await db.create(
			connections,
			{ id: generateUUID(), provider, external_id: externalId, subject_id: subjectId },
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Lists every provider identity linked to a subject, oldest link first.
	 *
	 * Exists so administration can see which providers an account can sign in with: a
	 * subject keeps a way in for as long as one connection or credential remains.
	 */
	static async findBySubjectId(db: Database, subjectId: string): Promise<SelectConnection[]> {
		return await db.findMany(connections, {
			where: { subject_id: subjectId },
			orderBy: ["created_at", "asc"],
		});
	}

	/**
	 * Unlinks a provider identity. Exists so provisioning can undo itself: this database
	 * has no transactions, so a sign-up that fails after the connection is written
	 * removes it explicitly.
	 *
	 * @returns Whether a row was removed.
	 */
	static async delete(db: Database, id: string): Promise<boolean> {
		return await db.delete(connections, id);
	}
}
