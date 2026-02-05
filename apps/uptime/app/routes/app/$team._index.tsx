import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";

import type { Route } from "./+types/$team._index";

export async function loader({ params }: Route.LoaderArgs) {
	if (team().memberships.some((m) => m.subjectId === subject().id)) {
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
		return redirect(href("/app/:team", { team: ownedTeam.slug }));
	}

	console.error(`The subject ${subject().id} does not have any team membership`);

	return redirect(href("/auth"));
}
