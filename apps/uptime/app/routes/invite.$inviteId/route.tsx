import { badRequest, forbidden, gone, notFound } from "@pkg/response";
import { and, eq } from "drizzle-orm";
import { href, redirect } from "react-router";

import { returnTo } from "~/cookies";
import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/route";

export async function loader({ request, params, context }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let subjectId = getSession().get("id");
	let email = getSession().get("email");

	if (!subjectId || !email) {
		let headers = new Headers();
		headers.append("Set-Cookie", await returnTo.serialize(`${url.pathname}${url.search}`));
		return redirect(href("/auth"), { headers });
	}

	let invite = await db().query.invites.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, params.inviteId);
		},
	});

	let { t } = i18next(context);

	if (!invite) {
		logger().info("loader.invite.not-found", { inviteId: params.inviteId });
		return notFound({ message: t("page.acceptInvite.errors.notFound") });
	}

	if (invite.acceptedAt !== null) {
		logger().info("loader.invite.already-accepted", { inviteId: params.inviteId });
		return gone({ message: t("page.acceptInvite.errors.gone") });
	}

	if (invite.email !== email) {
		logger().info("loader.invite.forbidden", {
			inviteId: params.inviteId,
			inviteEmail: invite.email,
			userEmail: email,
		});
		return forbidden({
			message: t("page.acceptInvite.errors.forbidden"),
		});
	}

	if (!email) {
		return badRequest({ message: t("page.acceptInvite.errors.badRequest") });
	}

	await db().batch([
		db()
			.update(schema.invites)
			.set({ acceptedAt: new Date() })
			.where(and(eq(schema.invites.id, params.inviteId), eq(schema.invites.email, email))),

		db().insert(schema.memberships).values({ teamId: invite.teamId, subjectId, role: "member" }),
	]);

	logger().info("loader.invite.accepted", {
		inviteId: params.inviteId,
		teamId: invite.teamId,
		subjectId,
	});

	return redirect(href("/app/:team", { team: invite.teamId }));
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main className="h-screen flex items-center justify-center text-center">
			<p className="text-2xl font-semibold">{loaderData.message}</p>
		</main>
	);
}
