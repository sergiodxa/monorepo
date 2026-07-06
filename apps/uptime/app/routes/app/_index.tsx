/**
 * Index route for `/app` that redirects the signed-in subject to their first team by
 * looking up the earliest-created membership, or to the marketing home page when they
 * belong to no team. It exists to land users on a concrete team without a chooser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { requireSubject } from "~/middleware/session";

export async function loader() {
	logger().info("appIndex.loader.start", {
		route: "app._index",
	});

	let subjectId = requireSubject();
	let membership = await db().query.memberships.findFirst({
		where(fields, operators) {
			return operators.eq(fields.subjectId, subjectId);
		},
		orderBy(fields, operators) {
			return operators.asc(fields.createdAt);
		},
		with: {
			team: {
				columns: { slug: true },
			},
		},
	});

	if (!membership) {
		logger().info("appIndex.loader.no-membership", {
			route: "app._index",
			subjectId,
		});
		return redirect(href("/"));
	}

	logger().info("appIndex.loader.redirect-to-team", {
		route: "app._index",
		subjectId,
		teamSlug: membership.team.slug,
	});

	return redirect(href("/app/:team", { team: membership.team.slug }));
}
