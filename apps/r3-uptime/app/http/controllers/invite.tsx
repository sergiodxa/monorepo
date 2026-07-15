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
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import Invite from "~/app/data/invite";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import DocumentLayout from "~/resources/layouts/document";
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
				<DocumentLayout title="Invite unavailable">
					<main mix={[css({ display: "flex", flexDirection: "column", minHeight: "100vh" })]}>
						<div
							mix={[
								css({
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									textAlign: "center",
									gap: 12,
									padding: "64px 32px",
									border: "1px dashed oklch(0.83 0.01 145)",
									borderRadius: 12,
									"@media (prefers-color-scheme: dark)": {
										borderColor: "oklch(0.42 0.008 145)",
									},
								}),
							]}
						>
							<h1 mix={[css({ margin: 0 })]}>Invite unavailable</h1>
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: "oklch(0.62 0.01 145)",
										"@media (prefers-color-scheme: dark)": {
											color: "oklch(0.73 0.01 145)",
										},
									}),
								]}
							>
								{message}
							</p>
							<a
								href={routes.home.href()}
								mix={[
									css({
										color: "oklch(0.6 0.16 142)",
										textDecoration: "none",
										"&:hover": { textDecoration: "underline" },
										"@media (prefers-color-scheme: dark)": {
											color: "oklch(0.78 0.16 142)",
										},
									}),
								]}
							>
								Back home
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
				`This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
			);
		}

		await Invite.accept(db, invite.id, invite.team_id, viewer.id);

		return redirect(routes.app.team.dashboard.index.href({ team: invite.team_id }), {
			status: redirect.Status.SeeOther,
		});
	}),
});
