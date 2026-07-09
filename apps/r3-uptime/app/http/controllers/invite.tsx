/**
 * Public accept-invite page. Requires `requireUser` (anonymous visitors are bounced
 * through sign-in and land back here via the `returnTo` cookie). Accepting is a
 * side effect of the GET itself — visiting the link IS accepting it, matching the
 * OLD APP. The invite must not already be accepted, and must have been sent to the
 * signed-in account's exact email.
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

import Invite from "~/app/data/invite";
import { getViewer } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import InviteErrorView from "~/resources/views/invite-error";
import routes from "~/routes/web";

/** GET /invite/:inviteId — accepts a team invite for the signed-in account. */
export default createAction(
	routes.invite,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { inviteId } = s.parse(s.object({ inviteId: s.string() }), ctx.params);
		let invite = await Invite.findById(db, inviteId);

		let renderError = (message: string) =>
			ctx.render(
				<DocumentLayout title="Invite unavailable">
					<InviteErrorView message={message} />
				</DocumentLayout>,
				{ status: 400 },
			);

		if (!invite) return renderError("This invite doesn't exist.");
		if (invite.accepted_at !== null) return renderError("This invite has already been accepted.");
		if (invite.email !== viewer.email) {
			return renderError(
				`This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
			);
		}

		await Invite.accept(db, invite.id, invite.team_id, viewer.id);

		return redirect(routes.app.team.dashboard.href({ team: invite.team_id }), {
			status: redirect.Status.SeeOther,
		});
	}),
);
