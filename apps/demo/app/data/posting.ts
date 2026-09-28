/**
 * Data access for job postings: the open listing the board renders, the search an agent
 * runs, publishing one, and the sweep that closes the stale ones. Every read hides an
 * expired posting, so "open" is stated here once instead of at each call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { and, isNull, like, lt, or } from "remix/data-table";

import type { Posting } from "~/database/schema";

import { postings } from "~/database/schema";

/** How many days a posting stays on the board before the nightly sweep closes it. */
export const POSTING_LIFETIME_DAYS = 30;

/** What publishing a posting requires; everything else is assigned here. */
export interface PublishPostingInput {
	title: string;
	company: string;
	location: string;
	salary: string;
	description: string;
	contact_email: string;
}

export default class Job {
	/** Open positions, newest first. */
	static async listOpen(db: Database, limit: number): Promise<Posting[]> {
		return await db.findMany(postings, {
			where: isNull(postings.expired_at),
			orderBy: ["created_at", "desc"],
			limit,
		});
	}

	/** One posting by id, expired or not, so a link to a closed position still resolves. */
	static async find(db: Database, id: string): Promise<Posting | null> {
		return await db.find(postings, id);
	}

	/** Open positions whose title, company or location contains `term`, newest first. */
	static async search(db: Database, term: string, limit: number): Promise<Posting[]> {
		let pattern = `%${term}%`;

		return await db.findMany(postings, {
			where: and(
				isNull(postings.expired_at),
				or(
					like(postings.title, pattern),
					like(postings.company, pattern),
					like(postings.location, pattern),
				),
			),
			orderBy: ["created_at", "desc"],
			limit,
		});
	}

	/** Publishes a posting and answers with the stored row, whose id the caller mails about. */
	static async publish(db: Database, input: PublishPostingInput): Promise<Posting> {
		let now = Date.now();

		return await db.create(
			postings,
			{
				...input,
				id: TypeID.fromUUID("job", generateUUID()).toString(),
				created_at: now,
				updated_at: now,
				expired_at: null,
			},
			{ returnRow: true },
		);
	}

	/**
	 * Closes every open posting published before `cutoff`.
	 *
	 * @returns How many postings the sweep closed, which the job records on its own log.
	 */
	static async expirePublishedBefore(db: Database, cutoff: number): Promise<number> {
		let now = Date.now();

		let result = await db.updateMany(
			postings,
			{ expired_at: now, updated_at: now },
			{ where: and(isNull(postings.expired_at), lt(postings.created_at, cutoff)) },
		);

		return result.affectedRows;
	}
}
