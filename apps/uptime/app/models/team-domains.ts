/**
 * The domains a team proves it owns, which signups on that domain auto-join and flow monitors
 * may reach. Adding one starts its verification: the write's `afterCommit` queues the TXT
 * lookup, and the hourly sweep retries whatever is still pending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { inList, isNull, notNull } from "remix/data-table";

import jobs from "~/app/jobs";
import { teamDomains } from "~/database/schema";

export const TeamDomains = createModel(teamDomains, {
	optional: ["id"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
		verified: (query) => query.where(notNull("verified_at")),
		unverified: (query) => query.where(isNull("verified_at")),
	},

	methods: {
		/**
		 * The hostnames a team has verified, which is what a flow monitor may be pointed at: a
		 * flow drives a sequence rather than sending one request, so it may only reach a domain
		 * the team has proved it owns.
		 */
		async verifiedHostnames(teamId: string): Promise<string[]> {
			let rows = await this.inTeam(teamId).verified().all();
			return rows.map((row) => row.hostname);
		},

		/**
		 * Verified hostnames for several teams at once, keyed by team id, so a sweep across many
		 * monitors reads each team's rows once. A team with no verified domain is absent from
		 * the map, leaving the caller to decide what an empty allowance means.
		 */
		async verifiedHostnamesByTeam(teamIds: string[]): Promise<Map<string, string[]>> {
			if (teamIds.length === 0) return new Map();

			let rows = await this.verified()
				.where(inList("team_id", [...new Set(teamIds)]))
				.all();

			let byTeam = new Map<string, string[]>();
			for (let row of rows) {
				let hostnames = byTeam.get(row.team_id);
				if (hostnames === undefined) byTeam.set(row.team_id, [row.hostname]);
				else hostnames.push(row.hostname);
			}
			return byTeam;
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				verified_at: values.verified_at ?? null,
			};
		},

		/**
		 * Queues the TXT lookup for a domain just added, so it is checked within seconds rather
		 * than at the next hourly sweep, which still retries whatever stays pending.
		 */
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.jobs.enqueue(jobs.verifyDomainOwnership, { teamDomainId: event.row.id });
		},
	},
});

/** A team domain, as reads return it. */
export type TeamDomain = ModelRow<typeof TeamDomains>;

export default TeamDomains;
