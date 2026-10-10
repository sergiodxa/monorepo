/**
 * Team invites: sent to an email, accepted by whoever signs in with it. Expiration is a
 * display-only notion the caller computes from `created_at`, so an invite stays acceptable
 * for as long as its row exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { isNull } from "remix/data-table";

import { invites, memberships } from "~/database/schema";

export const Invites = createModel(invites, {
	optional: ["id"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
		pending: (query) => query.where(isNull("accepted_at")),
	},

	methods: {
		/**
		 * Marks an invite accepted and makes `subjectId` a member of its team, as two sequential
		 * writes, which is as atomic as D1 gets. Answers the accepted invite, or `NotFound` for an
		 * invite deleted since it was read.
		 */
		async accept(inviteId: string, subjectId: string) {
			let accepted = await this.update(inviteId, { accepted_at: Date.now() });
			if (isFailure(accepted)) return accepted;

			await this.db.create(
				memberships,
				{
					id: generateUUID(),
					team_id: accepted.data.team_id,
					subject_id: subjectId,
					role: "member",
				},
				{ touch: true, returnRow: true },
			);
			return accepted;
		},

		/**
		 * Deletes the invite for `email` on a team, if one exists, so a member removed from the
		 * team cannot walk back in through the invite that first let them join.
		 */
		async withdraw(teamId: string, email: string): Promise<void> {
			let existing = await this.inTeam(teamId).where({ email }).first();
			if (existing !== null) await this.delete(existing.id);
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				accepted_at: values.accepted_at ?? null,
			};
		},
	},
});

/** An invite, as reads return it. */
export type Invite = ModelRow<typeof Invites>;

export default Invites;
