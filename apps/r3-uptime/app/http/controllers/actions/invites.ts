/**
 * Form actions for creating and revoking team invites. Requires
 * `requireRole("admin")`. Creating an invite for an email that already has a pending
 * invite resends it instead of creating a duplicate row, matching the OLD APP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";
import { Resend } from "resend";

import Invite from "~/app/data/invite";
import { CreateInviteSchema, RevokeInviteSchema } from "~/app/http/validators/invite";
import { sendInviteEmail } from "~/app/services/invite-email";
import routes from "~/routes/web";

/** POST /actions/:team/create-invite */
export const createInvite = createAction(routes.teamAdminActions.invite.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateInviteSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: "Enter a valid email address." });
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let { email } = result.data;

	let existing = await Invite.findByEmailForTeam(db, ctx.team.id, email);
	if (existing && existing.accepted_at !== null) {
		return badRequest(`${email} already accepted an invite to this team.`);
	}

	let invite = existing ?? (await Invite.create(db, ctx.team.id, ctx.membership.subject_id, email));

	let url = new URL(routes.invite.href({ inviteId: invite.id }), ctx.request.url).toString();
	let resend = getServiceContainer().get(Resend);
	await sendInviteEmail(resend, ctx.team.name, email, url);

	session?.flash("toast", { intent: "success", message: `Invite sent to ${email}.` });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** DELETE /actions/:team/revoke-invite */
export const revokeInvite = createAction(routes.teamAdminActions.invite.revoke, async (ctx) => {
	let result = await validate(ctx.formData, RevokeInviteSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let invite = await Invite.findByIdForTeam(db, ctx.team.id, result.data.invite_id);
	if (!invite) return notFound("Not Found");
	if (invite.accepted_at !== null) return badRequest("This invite was already accepted.");

	await Invite.revoke(db, invite.id);

	session?.flash("toast", { intent: "success", message: `Invite to ${invite.email} revoked.` });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
