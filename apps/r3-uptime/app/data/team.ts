/**
 * Data-access model for teams. Finds a team by id or slug, resolves a subject's
 * membership in a team, lists the teams a subject belongs to, auto-joins a subject to
 * teams whose verified domain matches their email, and provisions a personal team with
 * an owning admin membership on first sign-in. Centralizes team lookup and
 * domain-based provisioning so auth and route guards share one implementation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { isUUID } from "@pkg/uuid";
import { inList } from "remix/data-table";

import type IdToken from "~/app/auth/value-objects/id-token";

import { memberships, teamDomains, teams } from "~/database/schema";

export default class Team {
	/** Finds a team by its UUID primary key or its unique slug. */
	static async findByIdOrSlug(db: Database, idOrSlug: string) {
		let where = isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
		return await db.findOne(teams, { where });
	}

	/** Finds a subject's membership row for a given team, or `null` when not a member. */
	static async findMembership(db: Database, teamId: string, subjectId: string) {
		return await db.findOne(memberships, { where: { team_id: teamId, subject_id: subjectId } });
	}

	/** Lists every team a subject belongs to. */
	static async listBySubjectId(db: Database, subjectId: string) {
		let rows = await db.findMany(memberships, { where: { subject_id: subjectId } });
		if (rows.length === 0) return [];
		return await db.findMany(teams, {
			where: inList(
				"id",
				rows.map((row) => row.team_id),
			),
		});
	}

	/**
	 * Joins a subject to every team whose verified domain matches their email's
	 * hostname, and returns the first such team.
	 */
	static async joinByDomain(db: Database, idToken: IdToken) {
		let hostname = idToken.email.split("@").at(-1);
		if (!hostname) throw new Error("Invalid email format");

		let domains = await db.findMany(teamDomains, { where: { hostname } });
		let verifiedDomains = domains.filter((domain) => domain.verified_at !== null);
		if (verifiedDomains.length === 0) return null;

		await Promise.allSettled(
			verifiedDomains.map((domain) =>
				db.create(
					memberships,
					{
						id: crypto.randomUUID(),
						subject_id: idToken.subject,
						team_id: domain.team_id,
						role: "member",
					},
					{ touch: true, returnRow: true },
				),
			),
		);

		let firstTeam = await db.findOne(teams, { where: { id: verifiedDomains[0]!.team_id } });
		if (!firstTeam) throw new Error("Failed to load the team joined by domain");
		return firstTeam;
	}

	/** Creates a personal team for a subject and makes them its owning admin. */
	static async createTeam(db: Database, idToken: IdToken) {
		let team = await db.create(
			teams,
			{
				id: crypto.randomUUID(),
				owner_id: idToken.subject,
				name: `${idToken.name}'s Team`,
				slug: `${idToken.username.toLowerCase()}-team`,
				logo: idToken.picture || null,
			},
			{ touch: true, returnRow: true },
		);

		await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: idToken.subject, team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		return team;
	}
}
