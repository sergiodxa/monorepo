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

import { generateUUID } from "@sdxc/uuid";
import { and, eq, inList, isNull, notNull } from "remix/data-table";

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

	/**
	 * The hostnames a team has verified. What a flow monitor may be pointed at (ADR-027 §2):
	 * a flow drives a sequence rather than sending one request, so it may only reach a domain
	 * the team has proved it owns.
	 */
	static async verifiedHostnamesForTeam(db: Database, teamId: string): Promise<string[]> {
		let rows = await db.findMany(teamDomains, {
			where: and(eq("team_id", teamId), notNull("verified_at")),
		});
		return rows.map((row) => row.hostname);
	}

	/**
	 * Verified hostnames for several teams at once, keyed by team id, so a sweep across
	 * many monitors reads each team's rows once. A team with no verified domain is
	 * absent from the map, leaving the caller to decide what an empty allowance means.
	 */
	static async verifiedHostnamesByTeamIds(
		db: Database,
		teamIds: string[],
	): Promise<Map<string, string[]>> {
		if (teamIds.length === 0) return new Map();

		let rows = await db.findMany(teamDomains, {
			where: and(inList("team_id", [...new Set(teamIds)]), notNull("verified_at")),
		});

		let byTeam = new Map<string, string[]>();
		for (let row of rows) {
			let hostnames = byTeam.get(row.team_id);
			if (hostnames === undefined) byTeam.set(row.team_id, [row.hostname]);
			else hostnames.push(row.hostname);
		}
		return byTeam;
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
