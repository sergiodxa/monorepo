/**
 * Form actions for creating and revoking team invites. Requires
 * `requireRole("admin")`. Creating an invite for an email that already has a pending
 * invite resends it instead of creating a duplicate row, and queues the invite email
 * for after the response, because a mail provider having a bad minute must not cost
 * the admin the invite they just created.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest, notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import { DEFAULT_EMAIL_LOCALE, emailTranslator } from "~/app/emails/locale";
import { TeamInviteEmail } from "~/app/emails/team-invite";
import { CreateInviteSchema, RevokeInviteSchema } from "~/app/http/validators/invite";
import { recordCost } from "~/app/services/cost";
import { checkEmailAddress } from "~/app/services/email-address";
import routes from "~/routes/web";

/**
 * POST /actions/:team/create-invite. The cost is recorded before the send so a rejected send is
 * still billed. The invite carries no admin locale, so the notification is written in the app's
 * fallback language, treating the requester's own locale as the last resort (ADR-030 §4).
 */
export const createInvite = createAction(routes.teamAdminActions.invite.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateInviteSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: "Enter a valid email address." });
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let { email } = result.data;

	/** The invite is only as good as the email carrying it, so a domain with no mail host is refused. */
	let deliverable = await checkEmailAddress(email);
	if (isFailure(deliverable)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.intl.t("actions.emailAddress.noMailServer", {
				domain: deliverable.error.domain,
			}),
		});
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let existing = await ctx.models.invites.inTeam(ctx.team.id).where({ email }).first();
	if (existing && existing.accepted_at !== null) {
		return badRequest(`${email} already accepted an invite to this team.`);
	}

	let invite =
		existing ??
		unwrap(
			await ctx.models.invites.create({
				team_id: ctx.team.id,
				sender_id: ctx.membership.subject_id,
				email: email,
			}),
		);

	let url = new URL(routes.invite.href({ inviteId: invite.id }), ctx.request.url).toString();

	recordCost("emailSent");

	ctx.email.later(
		new TeamInviteEmail({
			team: ctx.team.name,
			email,
			url,
			locale: DEFAULT_EMAIL_LOCALE,
			t: emailTranslator(DEFAULT_EMAIL_LOCALE).t,
		}),
	);

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

	let invite = await ctx.models.invites
		.inTeam(ctx.team.id)
		.where({ id: result.data.invite_id })
		.first();
	if (!invite) return notFound("Not Found");
	if (invite.accepted_at !== null) return badRequest("This invite was already accepted.");

	unwrap(await ctx.models.invites.delete(invite.id));

	session?.flash("toast", { intent: "success", message: `Invite to ${invite.email} revoked.` });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
