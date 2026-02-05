import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { requireSubject } from "~/middleware/session";

export async function loader() {
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

	if (!membership) return redirect(href("/"));
	return redirect(href("/app/:team", { team: membership.team.slug }));
}
