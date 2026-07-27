/**
 * Public accept-invite page. Requires `requireUser` (anonymous visitors are bounced
 * through sign-in and land back here via the `returnTo` cookie). Accepting is a side
 * effect of the GET itself — visiting the link IS accepting it. The invite must not
 * already be accepted, and must have been sent to the signed-in account's exact email.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { m, minBs, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { fontSize, textAlign, textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Invite from "~/app/data/invite";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

/** GET /invite/:inviteId — accepts a team invite for the signed-in account. */
export default createAction(routes.invite, {
	middleware: [requireUser],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { inviteId } = s.parse(s.object({ inviteId: s.string() }), ctx.params);
		let invite = await Invite.findById(db, inviteId);

		let renderError = (message: string) =>
			ctx.render(
				<DocumentLayout title={ctx.i18next.t("page.acceptInvite.errors.pageTitle")}>
					<main mix={[flex(), flexCol(), minBs("100vh")]}>
						<div
							mix={[
								flex(),
								flexCol(),
								items("center"),
								textAlign("center"),
								gap("12px"),
								p("64px", "32px"),
								border({ color: neutral[300], width: 1, style: "dashed" }),
								rounded("12px"),
								media("(prefers-color-scheme: dark)", border(neutral[700])),
							]}
						>
							<h1 mix={[m("0")]}>{ctx.i18next.t("page.acceptInvite.errors.pageTitle")}</h1>
							<p
								mix={[
									fontSize("0.8125rem"),
									fg(neutral[500]),
									media("(prefers-color-scheme: dark)", fg(neutral[400])),
								]}
							>
								{message}
							</p>
							<a
								href={routes.home.href()}
								mix={[
									fg(primary[600]),
									textDecoration("none"),
									hover(textDecoration("underline")),
									media("(prefers-color-scheme: dark)", fg(primary[400])),
								]}
							>
								{ctx.i18next.t("errors.backHome")}
							</a>
						</div>
					</main>
				</DocumentLayout>,
				{ status: 400 },
			);

		if (!invite) return renderError(ctx.i18next.t("page.acceptInvite.errors.notFound"));
		if (invite.accepted_at !== null) {
			return renderError(ctx.i18next.t("page.acceptInvite.errors.gone"));
		}
		if (invite.email !== viewer.email) {
			return renderError(
				ctx.i18next.t("page.acceptInvite.errors.wrongEmail", { email: invite.email }),
			);
		}

		await Invite.accept(db, invite.id, invite.team_id, viewer.id);

		return redirect(routes.app.team.dashboard.index.href({ team: invite.team_id }), {
			status: redirect.Status.SeeOther,
		});
	}),
});
