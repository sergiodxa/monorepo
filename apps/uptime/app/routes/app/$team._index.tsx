/**
 * Index route for a team slug that only redirects: members go to the team dashboard,
 * the team's owner is sent to their canonical team page, and anyone without a matching
 * membership or ownership is bounced to auth. It exists to resolve the bare
 * `/app/:team` URL to the right destination.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";

import type { Route } from "./+types/$team._index";

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("teamIndex.loader.start", {
		route: "app.$team._index",
		teamSlug: params.team,
	});

	if (team().memberships.some((m) => m.subjectId === subject().id)) {
		logger().info("teamIndex.loader.redirect-to-dashboard", {
			route: "app.$team._index",
			teamId: team().id,
		});
		return redirect(href("/app/:team/dashboard", params));
	}

	let ownedTeam = await measure("findSubjectOwnedTeam", () => {
		return db().query.teams.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.ownerId, subject().id),
					operators.eq(fields.slug, params.team),
				);
			},
		});
	});

	if (ownedTeam) {
		logger().info("teamIndex.loader.redirect-to-owned-team", {
			route: "app.$team._index",
			ownedTeamSlug: ownedTeam.slug,
		});
		return redirect(href("/app/:team", { team: ownedTeam.slug }));
	}

	logger().error("teamIndex.loader.no-membership", {
		route: "app.$team._index",
		subjectId: subject().id,
	});

	return redirect(href("/auth"));
}
