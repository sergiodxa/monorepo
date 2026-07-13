/**
 * Data-access model for team domains: adding/removing a domain a team wants
 * auto-join-on-signup verified for, and the two queries the verification background
 * jobs need (every unverified domain, and one by id). Verification itself lives in
 * `app/jobs/verify-domain-ownership.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { isNull } from "remix/data-table";

import { teamDomains } from "~/database/schema";

export default class TeamDomain {
	/** Adds a domain for a team, pending verification. */
	static async create(db: Database, teamId: string, hostname: string) {
		return await db.create(
			teamDomains,
			{ id: generateUUID(), team_id: teamId, hostname, verified_at: null },
			{ touch: true, returnRow: true },
		);
	}

	/** Finds a domain by hostname on a team, verified or not. */
	static async findByHostnameForTeam(db: Database, teamId: string, hostname: string) {
		return await db.findOne(teamDomains, { where: { team_id: teamId, hostname } });
	}

	/** Finds a domain scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, domainId: string) {
		return await db.findOne(teamDomains, { where: { id: domainId, team_id: teamId } });
	}

	/** Finds a domain by id, for the verification job. */
	static async findById(db: Database, domainId: string) {
		return await db.findOne(teamDomains, { where: { id: domainId } });
	}

	/** Lists every domain for a team, most recently added first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(teamDomains, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Lists every domain across every team that has not yet been verified. */
	static async listUnverified(db: Database) {
		return await db.findMany(teamDomains, { where: isNull("verified_at") });
	}

	/** Marks a domain verified now. */
	static async markVerified(db: Database, domainId: string) {
		return await db.update(teamDomains, domainId, { verified_at: Date.now() }, { touch: true });
	}

	/** Removes a domain. */
	static async deleteById(db: Database, domainId: string) {
		await db.delete(teamDomains, domainId);
	}
}
