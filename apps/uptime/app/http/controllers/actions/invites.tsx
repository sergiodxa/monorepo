/**
 * Form actions for creating and revoking team invites. Requires
 * `requireAbility(abilities.invites.write)`. Creating an invite for an email that already has a pending
 * invite resends it instead of creating a duplicate row, and hands the invite email to the `email` job,
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

import type { FormSubmission } from "~/app/http/validators/form-submission";

import emails from "~/app/emails";
import { Admin } from "~/app/http/middleware/admin";
import { CreateInviteSchema, RevokeInviteSchema } from "~/app/http/validators/invite";
import { createManagementClient } from "~/app/initializers/management-client";
import { recordCost } from "~/app/services/cost";
import { checkEmailAddress } from "~/app/services/email-address";
import { loadTeamSettings } from "~/app/services/team-settings";
import TeamSettingsPage from "~/resources/views/settings/settings-page";
import routes from "~/routes/web";

/**
 * POST /actions/:team/create-invite. A refused address answers 422 with the invite dialog open
 * on what was typed. The cost is recorded before the send so a rejected send is still billed;
 * the invite carries no admin locale, so it is written in the app's fallback language.
 */
export const createInvite = createAction(routes.teamAdminActions.invite.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateInviteSchema);
	let session = ctx.get(Session);

	/** Draws the settings page again with the invite dialog open on the refused address. */
	let sendBack = async (message: string) => {
		if (!ctx.has(Admin)) ctx.set(Admin, createManagementClient(), { property: "admin" });
		let settings = await loadTeamSettings(ctx.models, ctx.admin, ctx.team);
		let submission: FormSubmission = {
			values: ctx.formData,
			issues: [{ message, path: ["email"] }],
		};
		return ctx.render(<TeamSettingsPage settings={settings} inviteSubmission={submission} />, {
			status: 422,
		});
	};

	if (isFailure(result)) {
		return sendBack(ctx.intl.t("actions.createInvite.errors.invalidEmail"));
	}

	let { email } = result.data;

	/** The invite is only as good as the email carrying it, so a domain with no mail host is refused. */
	let deliverable = await checkEmailAddress(email);
	if (isFailure(deliverable)) {
		return sendBack(
			ctx.intl.t("actions.emailAddress.noMailServer", { domain: deliverable.error.domain }),
		);
	}

	let existing = await ctx.models.invites.inTeam(ctx.team.id).where({ email }).first();
	if (existing && existing.accepted_at !== null) {
		return sendBack(
			ctx.intl.t("actions.createInvite.errors.alreadyAccepted", { team: ctx.team.name }),
		);
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

	let queued = await ctx.email.queue(emails.teams.invite, {
		to: email,
		props: { team: ctx.team.name, url },
	});
	if (isFailure(queued)) {
		ctx.log.warn("invites.email_queue_failed", { error: queued.error.message });
	}

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.createInvite.success", { email, team: ctx.team.name }),
	});
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
	if (invite.accepted_at !== null) {
		return badRequest(ctx.intl.t("actions.revokeInvite.errors.alreadyAccepted"));
	}

	unwrap(await ctx.models.invites.delete(invite.id));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.revokeInvite.success", {
			email: invite.email,
			team: ctx.team.name,
		}),
	});
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
