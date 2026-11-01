/**
 * Form actions reached from the account page, addressed by the viewer's own subject id and
 * authorized by `requireUser` alone: creating an additional team, leaving a team, changing
 * the UI language preference, choosing which optional emails to receive, downloading eve
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

import { getViewer } from "~/app/http/middleware/auth";
import { RequestAccountDeletionSchema } from "~/app/http/validators/account";
import { UpdateEmailsSchema } from "~/app/http/validators/email-preferences";
import { UpdateLanguageSchema } from "~/app/http/validators/language";
import { CreateTeamSchema, LeaveTeamSchema } from "~/app/http/validators/team";
import { language as languageCookie } from "~/app/initializers/cookies";
import abilities from "~/app/policies/abilities";
import policy, { rolesOf } from "~/app/policies/policy";
import { accountExportFilename, buildAccountExport } from "~/app/services/account-export";
import { loadAccountOverview } from "~/app/services/account-overview";
import { optionalEmails } from "~/database/schema";
import AccountPage from "~/resources/views/account/account-page";
import routes from "~/routes/web";

/**
 * POST /actions/create-team. A refused name draws the account page again, answered as 422,
 * inside the shell of the team the form names, with the create-team dialog open on what was
 * typed; a form naming no team the viewer belongs to answers a plain 400.
 */
export const createTeam = createAction(routes.accountActions.createTeam, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, CreateTeamSchema);
	if (isFailure(result)) {
		let message = ctx.intl.t("actions.createTeam.errors.name");
		let shellTeam = ctx.formData.get("team");
		let [team, teams] = await Promise.all([
			typeof shellTeam === "string" ? ctx.models.teams.findByIdOrSlug(shellTeam) : null,
			ctx.models.teams.listForSubject(viewer.id),
		]);
		let membership = team ? await ctx.models.memberships.findFor(team.id, viewer.id) : null;
		if (!team || !membership) return badRequest(message);

		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = teams;

		let overview = await loadAccountOverview(ctx.models, viewer.id);
		let submission: FormSubmission = {
			values: ctx.formData,
			issues: [{ message, path: ["name"] }],
		};
		return ctx.render(<AccountPage overview={overview} createTeamSubmission={submission} />, {
			status: 422,
		});
	}

	let team = unwrap(await ctx.models.teams.createAdditional(viewer.id, result.data.name));

	return redirect(routes.app.team.dashboard.index.href({ team: team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/leave-team. Binds the team the form names, since no team is in the URL. */
export const leaveTeam = createAction(routes.accountActions.leaveTeam, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, LeaveTeamSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(ctx.request.headers.get("Referer") ?? routes.home.href(), {
			status: redirect.Status.SeeOther,
		});
	}

	let membership = await ctx.models.memberships.findFor(result.data.team_id, viewer.id);
	if (!membership) return notFound("Not Found");

	let team = await ctx.models.teams.findByIdOrSlug(result.data.team_id);
	if (!team) return notFound("Not Found");

	let access = unwrap(policy.for({ roles: rolesOf(team, membership) }));
	let decision = access.check(abilities.team.leave, {
		member: { role: membership.role, isOwner: team.owner_id === viewer.id },
	});
	if (!decision.allowed && decision.cause === "denied" && decision.reason === "owner") {
		return badRequest(ctx.intl.t("actions.leaveTeam.errors.ownerCannotLeave"));
	}
	if (!decision.allowed) {
		return badRequest(ctx.intl.t("actions.leaveTeam.errors.adminCannotLeave"));
	}

	await ctx.models.memberships.remove(result.data.team_id, viewer.id);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.leaveTeam.success", { team: team.name }),
	});
	return redirect(routes.home.href(), { status: redirect.Status.SeeOther });
});

/**
 * Stores the complement of what the form posts: an unchecked switch sends nothing, so
 * storing which emails are missing is the only unambiguous record of an all-off
 * submission, and it doubles as a future account-wide opt-out with no backfill needed.
 */
export const updateEmails = createAction(routes.accountActions.updateEmails, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, UpdateEmailsSchema);
	if (isFailure(result)) return badRequest(ctx.intl.t("actions.updateEmails.errors.invalid"));

	let wanted = new Set(result.data.emails);
	let unsubscribed = optionalEmails.filter((email) => !wanted.has(email));

	unwrap(await ctx.models.userPreferences.setUnsubscribedEmails(viewer.id, unsubscribed));

	let session = ctx.get(Session);
	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.updateEmails.success"),
	});

	return redirect(ctx.request.headers.get("Referer") ?? routes.home.href(), {
		status: redirect.Status.SeeOther,
	});
});

/**
 * Assembled from a handful of indexed reads scoped to one person and answered inline,
 * so the browser's `no-store` response is the only copy of this sensitive document —
 * there is nothing to schedule, store, or later revoke.
 */
export const exportData = createAction(routes.accountActions.exportData, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let now = new Date();
	let document = await buildAccountExport(
		ctx.models,
		{ id: viewer.id, name: viewer.name, email: viewer.email },
		now,
	);

	return new Response(JSON.stringify(document, null, 2), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"content-disposition": `attachment; filename="${accountExportFilename(viewer.id, now)}"`,
			"cache-control": "no-store",
		},
	});
});

/**
 * The row is written before the session ends, so a failure between the two still leaves
 * the request queued and reporting as such on the next page load. The email travels with
 * the row because the OIDC subject holds no address of its own once the session is gone.
 */
export const requestDeletion = createAction(routes.accountActions.requestDeletion, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, RequestAccountDeletionSchema);
	if (isFailure(result)) {
		return badRequest(ctx.intl.t("page.account.deleteAccount.card.confirmation.label"));
	}

	await ctx.models.accountDeletions.enqueue(viewer.id, viewer.email);

	ctx.get(Session)?.destroy();

	return redirect(routes.home.href(), { status: redirect.Status.SeeOther });
});

/**
 * Dropping the row is enough, since the sweep only deletes what is still queued. Reaching
 * this again requires signing back in, which is itself the safeguard — so a viewer with
 * nothing queued gets the same quiet success as one who just cancelled.
 */
export const cancelDeletion = createAction(routes.accountActions.cancelDeletion, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	await ctx.models.accountDeletions.remove(viewer.id);

	let session = ctx.get(Session);
	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.cancelAccountDeletion.success"),
	});

	return redirect(ctx.request.headers.get("Referer") ?? routes.home.href(), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/update-language */
export const updateLanguage = createAction(routes.accountActions.updateLanguage, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, UpdateLanguageSchema);
	if (isFailure(result)) {
		return badRequest(ctx.intl.t("actions.updateLanguage.errors.generic"));
	}

	unwrap(await ctx.models.userPreferences.setLanguage(viewer.id, result.data.language));

	let headers = new Headers();
	headers.set("Set-Cookie", await languageCookie.serialize(result.data.language ?? ""));

	return redirect(ctx.request.headers.get("Referer") ?? routes.home.href(), {
		status: redirect.Status.SeeOther,
		headers,
	});
});
