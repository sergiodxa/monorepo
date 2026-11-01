/**
 * Gathers what the team settings page lists: members with their identity-provider profiles,
 * pending invites, domains, and whether billing needs attention. The page's route and every
 * action that draws the page again after a refused form read through it, so they list the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@sdxc/auth/management-client";

import type { UptimeModels } from "~/app/models";
import type {
	SelectInvite,
	SelectMembership,
	SelectTeam,
	SelectTeamDomain,
} from "~/database/schema";

import { resolveSubjects } from "~/app/services/subjects";

/** Everything the team settings page lists, newest invite and domain first. */
export interface TeamSettings {
	members: SelectMembership[];
	pendingInvites: SelectInvite[];
	domains: SelectTeamDomain[];
	/** Each member's profile at the identity provider; a member it holds no record for is absent. */
	subjectsById: Map<string, ManagementClient.Subject>;
}

/**
 * Reads `team`'s settings page contents, resolving member profiles through `admin` once the
 * memberships are known.
 *
 * @param models - The request's model registry.
 * @param admin - Management client the member profiles are read through.
 * @param team - The team whose settings render.
 */
export async function loadTeamSettings(
	models: UptimeModels,
	admin: ManagementClient,
	team: Pick<SelectTeam, "id" | "owner_id">,
): Promise<TeamSettings> {
	let [members, pendingInvites, domains] = await Promise.all([
		models.memberships.inTeam(team.id).all(),
		models.invites.inTeam(team.id).pending().orderBy("created_at", "desc").all(),
		models.teamDomains.inTeam(team.id).orderBy("created_at", "desc").all(),
	]);

	let subjectsById = await resolveSubjects(
		admin,
		members.map((member) => member.subject_id),
	);

	return { members, pendingInvites, domains, subjectsById };
}
