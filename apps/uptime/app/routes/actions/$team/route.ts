import { href, redirect } from "react-router";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { getSession } from "~/middleware/session";
import { SubjectContext, subject } from "~/middleware/subject";
import { type Team, TeamContext, team } from "~/middleware/team";

import type { Route } from "./+types/route";

export const middleware: Route.MiddlewareFunction[] = [
	// Read subject from session and ensure it's authenticated
	async ({ context }, next) => {
		let session = getSession();

		// User is not authenticated, go to login
		if (!session.has("id")) throw redirect(href("/auth"));

		let subject = z
			.object({
				id: z.string(),
				name: z.string(),
				avatar: z.url(),
				email: z.email(),
			})
			.parse(session.data);

		context.set(SubjectContext, subject);

		return await next();
	},

	// Find the team by slug and set it in the context
	async ({ params, context }, next) => {
		let team = await db().query.teams.findFirst({
			where(fields, operators) {
				return operators.eq(fields.slug, params.team);
			},
			with: {
				memberships: {
					columns: { subjectId: true, role: true },
					where(fields, operators) {
						return operators.eq(fields.subjectId, subject().id);
					},
				},
			},
		});

		if (!team) throw redirect(href("/"));
		context.set(TeamContext, team as Team);
		return await next();
	},

	// Ensure the subject is a member of the team
	async (_, next) => {
		if (team().memberships.some((m) => m.subjectId === subject().id)) {
			return await next();
		}

		let membership = await db().query.memberships.findFirst({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subject().id);
			},
			with: {
				team: {
					columns: { slug: true },
				},
			},
		});

		if (membership) {
			throw redirect(href("/app/:team", { team: membership.team.slug }));
		}

		console.error(`The subject ${subject().id} does not have any team membership`);

		throw redirect(href("/auth"));
	},
];
