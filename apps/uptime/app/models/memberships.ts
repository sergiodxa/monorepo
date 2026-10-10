/**
 * Who belongs to which team, and as what. A membership is what every team page and action
 * authorizes against; it is created with the team for its owner, by accepting an invite, or
 * by signing in with an email on a domain the team verified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdToken } from "@sdxc/auth/id-token";
import type { ModelRow } from "@sdxc/data-model";

import { createModel, NotFound } from "@sdxc/data-model";
import { failure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { notNull } from "remix/data-table";

import type { SelectTeam } from "~/database/schema";

import { memberships, teamDomains, teams } from "~/database/schema";

/** What a member may do on a team: an admin manages it, a member uses it. */
export type MembershipRole = "member" | "admin";

export const Memberships = createModel(memberships, {
	optional: ["id"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
		ofSubject: (query, subjectId: string) => query.where({ subject_id: subjectId }),
	},

	methods: {
		/** A subject's membership on a team, or `null` when they are not a member of it. */
		findFor(teamId: string, subjectId: string) {
			return this.inTeam(teamId).ofSubject(subjectId).first();
		},

		/**
		 * Changes a subject's role on a team, answering `NotFound` when they hold no membership
		 * there, since a role only exists on a membership.
		 */
		async setRole(teamId: string, subjectId: string, role: MembershipRole) {
			let membership = await this.inTeam(teamId).ofSubject(subjectId).first();
			if (membership === null) {
				return failure(new NotFound("memberships", { team_id: teamId, subject_id: subjectId }));
			}
			return await this.update(membership.id, { role });
		},

		/**
		 * Removes a subject's membership from a team, which serves an admin removing someone and
		 * a member leaving alike. A subject who is not a member leaves nothing to remove.
		 */
		async remove(teamId: string, subjectId: string): Promise<void> {
			let membership = await this.inTeam(teamId).ofSubject(subjectId).first();
			if (membership !== null) await this.delete(membership.id);
		},

		/**
		 * Joins a subject to every team whose verified domain matches their email's hostname,
		 * and answers the first such team, or `null` when no verified domain matches. Each join
		 * is attempted independently, so one refused membership never blocks the others.
		 *
		 * @throws When the email has no hostname to match, which a signed-in subject always has.
		 */
		async joinByDomain(idToken: IdToken): Promise<SelectTeam | null> {
			let hostname = (idToken.email ?? "").split("@").at(-1);
			if (!hostname) throw new Error("Invalid email format");

			let verified = await this.db
				.query(teamDomains)
				.where({ hostname })
				.where(notNull("verified_at"))
				.all();
			if (verified.length === 0) return null;

			await Promise.allSettled(
				verified.map((domain) =>
					this.create({ subject_id: idToken.subject, team_id: domain.team_id, role: "member" }),
				),
			);

			let firstTeam = await this.db.findOne(teams, { where: { id: verified[0]!.team_id } });
			if (!firstTeam) throw new Error("Failed to load the team joined by domain");
			return firstTeam;
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A membership, as reads return it. */
export type Membership = ModelRow<typeof Memberships>;

export default Memberships;
