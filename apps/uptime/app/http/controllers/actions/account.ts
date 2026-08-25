/**
 * Form actions reached from the account page, addressed by the viewer's own subject id
 * and authorized by `requireUser` alone: creating an additional team, leaving a team,
 * changing the UI language preference, choosing which optional emails to receive,
 * downloading everything the app holds about the viewer, and asking for — or calling
 * off — the deletion of the account.
 *
 * {@link requestDeletion} queues the account for the daily sweep to delete and signs the
 * person out, buying the grace period {@link cancelDeletion} spends before the sweep runs.
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
import { createAction } from "remix/router";
import { Session } from "remix/session";

import AccountDeletion from "~/app/data/account-deletion";
import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { language as languageCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import { RequestAccountDeletionSchema } from "~/app/http/validators/account";
import { UpdateEmailsSchema } from "~/app/http/validators/email-preferences";
import { UpdateLanguageSchema } from "~/app/http/validators/language";
import { CreateTeamSchema, LeaveTeamSchema } from "~/app/http/validators/team";
import { accountExportFilename, buildAccountExport } from "~/app/services/account-export";
import { optionalEmails } from "~/database/schema";
import routes from "~/routes/web";

/** POST /actions/create-team */
export const createTeam = createAction(routes.accountActions.createTeam, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, CreateTeamSchema);
	if (isFailure(result)) {
		return badRequest("Enter a team name.");
	}

	let db = getServiceContainer().get(Database);
	let team = await Team.createAdditional(db, viewer.id, result.data.name);

	return redirect(routes.app.team.dashboard.index.href({ team: team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/leave-team */
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

	let db = getServiceContainer().get(Database);
	let membership = await Team.findMembership(db, result.data.team_id, viewer.id);
	if (!membership) return notFound("Not Found");

	let team = await Team.findByIdOrSlug(db, result.data.team_id);
	if (!team) return notFound("Not Found");

	if (team.owner_id === viewer.id) return badRequest("The team owner can't leave the team.");
	if (membership.role === "admin") {
		return badRequest("Admins must be demoted to a member before leaving.");
	}

	await Team.removeMembership(db, result.data.team_id, viewer.id);

	session?.flash("toast", { intent: "success", message: `Left "${team.name}".` });
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
	if (isFailure(result)) return badRequest("Invalid email preferences.");

	let wanted = new Set(result.data.emails);
	let unsubscribed = optionalEmails.filter((email) => !wanted.has(email));

	let db = getServiceContainer().get(Database);
	await UserPreferences.setUnsubscribedEmails(db, viewer.id, unsubscribed);

	let session = ctx.get(Session);
	session?.flash("toast", { intent: "success", message: "Email preferences saved." });

	return redirect(ctx.request.headers.get("Referer") ?? routes.home.href(), {
		status: redirect.Status.SeeOther,
	});
});

/**
 * Assembled from a handful of indexed reads scoped to one person and answered inline,
 * so the browser's `no-store` response is the only copy of this sensitive document —
 * there is nothing to schedule, store, or later revoke.
 */
export const exportData = createAction(routes.accountActions.exportData, async () => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let db = getServiceContainer().get(Database);
	let now = new Date();
	let document = await buildAccountExport(
		db,
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
		return badRequest('Type "DELETE" to confirm.');
	}

	let db = getServiceContainer().get(Database);
	await AccountDeletion.enqueue(db, viewer.id, viewer.email);

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

	let db = getServiceContainer().get(Database);
	await AccountDeletion.remove(db, viewer.id);

	let session = ctx.get(Session);
	session?.flash("toast", { intent: "success", message: "Account deletion cancelled." });

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
		return badRequest("Invalid language.");
	}

	let db = getServiceContainer().get(Database);
	await UserPreferences.setLanguage(db, viewer.id, result.data.language);

	let headers = new Headers();
	headers.set("Set-Cookie", await languageCookie.serialize(result.data.language ?? ""));

	return redirect(ctx.request.headers.get("Referer") ?? routes.home.href(), {
		status: redirect.Status.SeeOther,
		headers,
	});
});
