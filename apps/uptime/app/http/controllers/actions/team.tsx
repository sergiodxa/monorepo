/**
 * Form actions for team settings and membership: update/delete a team, and
 * remove/promote/demote a member.
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

import { Admin } from "~/app/http/middleware/admin";
import { issueField, translateIssues } from "~/app/http/validators/form-submission";
import {
	ChangeRoleSchema,
	DeleteTeamSchema,
	RemoveMemberSchema,
	UpdateTeamSchema,
} from "~/app/http/validators/team";
import { createManagementClient } from "~/app/initializers/management-client";
import abilities from "~/app/policies/abilities";
import { cancelSubscriptions } from "~/app/services/customer";
import { loadTeamSettings } from "~/app/services/team-settings";
import TeamSettingsPage from "~/resources/views/settings/settings-page";
import routes from "~/routes/web";

/**
 * POST /actions/:team/update-team. A rejected submission renders the settings page again with
 * a 422, the submitted text in both fields and the error beside each rejected one, so nothing
 * typed is lost.
 */
export const updateTeam = createAction(routes.teamAdminActions.team.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateTeamSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		if (!ctx.has(Admin)) ctx.set(Admin, createManagementClient(), { property: "admin" });
		let settings = await loadTeamSettings(ctx.models, ctx.admin, ctx.team);
		let issues = translateIssues(
			result.error.issues.filter((issue) => ["name", "logo"].includes(issueField(issue) ?? "")),
			(field) => ({
				field,
				message: ctx.intl.t(
					field === "logo"
						? "page.settings.form.fields.logo.error"
						: "page.settings.fieldErrors.name",
				),
			}),
		);
		return ctx.render(
			<TeamSettingsPage settings={settings} profileSubmission={{ values: ctx.formData, issues }} />,
			{ status: 422 },
		);
	}

	let { name, logo } = result.data;
	unwrap(await ctx.models.teams.update(ctx.team.id, { name, logo: logo || null }));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.updateTeam.success.updated"),
	});
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/**
 * DELETE /actions/:team/delete-team — the router admits any admin, and only the owner deletes,
 * after typing the team's exact name.
 */
export const deleteTeam = createAction(routes.teamAdminActions.team.delete, async (ctx) => {
	await ctx.access.load(abilities.team.delete);
	if (!ctx.access.can(abilities.team.delete)) {
		return badRequest(ctx.intl.t("actions.deleteTeam.errors.forbidden"));
	}

	let result = await validate(ctx.formData, DeleteTeamSchema);
	if (isFailure(result) || result.data.confirmation !== ctx.team.name) {
		return badRequest(ctx.intl.t("actions.deleteTeam.errors.nameMismatch"));
	}

	/**
	 * A refused cancellation is logged rather than raised: the team and its data go either
	 * way, and leaving a subscription running is recoverable from the platform's own dashboard
	 * while a half-deleted team is not.
	 */
	let cancelled = await cancelSubscriptions(ctx.billing, ctx.team.owner_id);

	if (isFailure(cancelled)) {
		ctx.log.warn("team.subscription_cancel_refused", {
			code: cancelled.error.code,
			provider_code: cancelled.error.providerCode,
			connection: cancelled.error.connection,
		});
	}

	unwrap(await ctx.models.teams.delete(ctx.team.id));

	return redirect(routes.home.href(), { status: redirect.Status.SeeOther });
});

/** DELETE /actions/:team/remove-member */
export const removeMember = createAction(routes.teamAdminActions.member.remove, async (ctx) => {
	let result = await validate(ctx.formData, RemoveMemberSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	await ctx.access.load(abilities.members.remove);
	if (
		!ctx.access.can(abilities.members.remove, {
			member: { isOwner: result.data.subject_id === ctx.team.owner_id },
		})
	) {
		return badRequest(ctx.intl.t("actions.removeMember.errors.cannotRemoveOwner"));
	}

	await ctx.models.memberships.remove(ctx.team.id, result.data.subject_id);
	await ctx.models.invites.withdraw(ctx.team.id, result.data.email);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.removeMember.success", {
			name: result.data.email,
			team: ctx.team.name,
		}),
	});
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/change-role */
export const changeRole = createAction(routes.teamAdminActions.member.changeRole, async (ctx) => {
	let result = await validate(ctx.formData, ChangeRoleSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	await ctx.access.load(abilities.members.changeRole);
	if (
		!ctx.access.can(abilities.members.changeRole, {
			member: { isOwner: result.data.subject_id === ctx.team.owner_id },
		})
	) {
		return badRequest(ctx.intl.t("actions.changeRole.errors.cannotChangeOwner"));
	}

	let membership = await ctx.models.memberships.findFor(ctx.team.id, result.data.subject_id);
	if (!membership) return notFound("Not Found");

	unwrap(
		await ctx.models.memberships.setRole(ctx.team.id, result.data.subject_id, result.data.role),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.changeRole.updated"),
	});
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
