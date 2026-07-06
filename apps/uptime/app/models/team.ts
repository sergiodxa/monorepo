/**
 * The data-access model for teams, exposing static methods over the Drizzle database. It
 * finds a team by UUID or slug (with memberships), lists teams a subject belongs to, auto-
 * joins users to teams whose verified email domain matches theirs, creates a personal team
 * with an owning admin membership on signup, and resolves a team's slug by id. It centralizes
 * team lookup, membership, and domain-based provisioning logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "~/db/index";
import type IdToken from "~/entities/id-token";

import * as schema from "~/db/schema";
import { isUUID } from "~/utils/uuid";

export default class Team {
	static async find(db: Database, idOrSlug: string) {
		return await db.query.teams.findFirst({
			where(fields, operators) {
				if (isUUID(idOrSlug)) {
					return operators.eq(fields.id, idOrSlug);
				}

				return operators.eq(fields.slug, idOrSlug);
			},
			with: {
				memberships: {
					columns: { subjectId: true, role: true },
				},
			},
		});
	}

	static async findBySubjectId(db: Database, subjectId: string) {
		let memberships = await db.query.memberships.findMany({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subjectId);
			},
			with: { team: true },
		});

		return memberships.map((m) => m.team);
	}

	static async joinByDomain(db: Database, idToken: IdToken) {
		let emailHostname = idToken.email.split("@").at(-1);
		if (!emailHostname) throw new Error("Invalid email format");

		let teamDomains = await db.query.teamDomains.findMany({
			where(fields, operators) {
				return operators.and(
					operators.isNotNull(fields.verifiedAt),
					operators.eq(fields.hostname, emailHostname),
				);
			},
			with: { team: true },
		});

		if (!teamDomains[0]) return null;

		await Promise.allSettled(
			teamDomains.map((teamDomain) => {
				return db.insert(schema.memberships).values({
					subjectId: idToken.subject,
					teamId: teamDomain.team.id,
					role: "member",
				});
			}),
		);

		return teamDomains[0].team;
	}

	static async createTeam(db: Database, idToken: IdToken) {
		let [team] = await db
			.insert(schema.teams)
			.values({
				ownerId: idToken.subject,
				name: `${idToken.name}'s Team`,
				slug: `${idToken.username.toLowerCase()}-team`,
				logo: idToken.picture || null,
			})
			.returning();

		if (!team) throw new Error("Failed to create team");

		await db.insert(schema.memberships).values({
			subjectId: idToken.subject,
			teamId: team.id,
			role: "admin",
		});

		return team;
	}

	static async findSlugById(db: Database, id: string) {
		let team = await db.query.teams.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id);
			},
		});

		if (team) return team.slug;
		throw new Error(`Team with ID ${id} not found`);
	}
}
