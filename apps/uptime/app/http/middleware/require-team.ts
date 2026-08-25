/**
 * Route guard resolving the `:team` URL param to a team the current viewer belongs to.
 * Attaches `ctx.team` and `ctx.membership` for downstream handlers, and responds 404
 * (never a redirect or 403) when the team doesn't exist or the viewer isn't a member,
 * so team existence is never leaked to non-members. Must run after `requireUser`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { notFound } from "@pkg/http/response/html";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import Team from "~/app/data/team";
import { getViewer } from "~/app/http/middleware/auth";
import { apportionCostByTeam } from "~/app/services/cost";

declare module "remix/router" {
	interface RequestContext {
		team: SelectTeam;
		membership: SelectMembership;
		teams: SelectTeam[];
	}
}

/**
 * Resolves `:team` to a team the current viewer is a member of, looking up the
 * viewer's teams concurrently since that lookup is independent of it, and
 * apportioning the cost of all three lookups to the resolved team (ADR-007 §5).
 *
 * @returns The downstream response, or a 404 when the team is missing or the viewer
 * is not a member.
 * @example
 * router.map(routes.app.team, { middleware: [requireUser, requireTeam], actions });
 */
export let requireTeam: Middleware = async (ctx, next) => {
	let idOrSlug = ctx.params.team!;
	let db = getServiceContainer().get(Database);

	let viewer = getViewer();
	if (!viewer) return notFound("Not Found");

	let [team, teams] = await Promise.all([
		Team.findByIdOrSlug(db, idOrSlug),
		Team.listBySubjectId(db, viewer.id),
	]);
	if (!team) return notFound("Not Found");

	let membership = await Team.findMembership(db, team.id, viewer.id);
	if (!membership) return notFound("Not Found");

	ctx.team = team;
	ctx.membership = membership;
	ctx.teams = teams;

	apportionCostByTeam([team.id]);

	return next();
};

export default requireTeam;
