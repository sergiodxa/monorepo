/**
 * Form actions reached from the account page rather than a specific team's URL
 * scope: creating an additional team, leaving a team, changing the UI language
 * preference, choosing which optional emails to receive, downloading everything the app
 * holds about the viewer, and asking for — or calling off — the deletion of the account.
 * Each only requires `requireUser` — none take a `:team` route param.
 *
 * Deletion is the odd one out: {@link requestDeletion} deletes nothing at all. It writes a row
 * to the queue the daily sweep works through and signs the person out, which is what buys the
 * grace period {@link cancelDeletion} spends. Doing it on the click would leave no window to
 * change one's mind in, and the queue makes that window free.
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
 * POST /actions/update-emails
 *
 * The form posts one value per switch left on, so this stores the complement: every optional
 * email the app knows about that the viewer did not ask for. Reading the form the other way
 * round — treating the posted values as the refusals — would be impossible, because an
 * unchecked switch posts nothing and a form with everything off is indistinguishable from a
 * request that touched no switch at all.
 *
 * Storing refusals rather than acceptances is also what makes a future digest opt-out for
 * everybody without a backfill; see the column's docblock in `database/schema.ts`.
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
 * POST /actions/export-data
 *
 * Answers with the whole document rather than a link to one: it is assembled in a handful of
 * indexed reads scoped to one person, so there is nothing to schedule and nothing to store —
 * and a stored export would be a second copy of everything sensitive, sitting somewhere with a
 * URL, which is a worse thing to hold than the request that produced it.
 *
 * `no-store` because the response body is an entire account and the browser is the only place
 * it should land.
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
 * POST /actions/request-account-deletion
 *
 * Queues the account and signs the person out. Nothing is deleted here — the daily sweep does
 * that — but they must not be left browsing an account they have just asked to have erased, so
 * the session is destroyed and they land on the marketing home page.
 *
 * The queued row is written before the session goes, and the two are not atomic: a failure
 * between them leaves a queued request and a live session, which the next page load reports as
 * the queued state. The reverse order would leave somebody signed out with no request recorded
 * and no way to see that nothing happened.
 */
export const requestDeletion = createAction(routes.accountActions.requestDeletion, async (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let result = await validate(ctx.formData, RequestAccountDeletionSchema);
	if (isFailure(result)) {
		return badRequest('Type "DELETE" to confirm.');
	}

	let db = getServiceContainer().get(Database);
	// The address is captured here because it exists nowhere else: an account is an OIDC
	// subject, and this is the only request that can hand the confirmation mail somewhere to go.
	await AccountDeletion.enqueue(db, viewer.id, viewer.email);

	ctx.get(Session)?.destroy();

	return redirect(routes.home.href(), { status: redirect.Status.SeeOther });
});

/**
 * DELETE /actions/cancel-account-deletion
 *
 * Drops the queued request, which is all it takes: the sweep reads the queue, so a row that is
 * gone is a deletion that never runs. Reaching this needs signing back in, which is exactly the
 * check that matters — whoever can still authenticate as the account is whoever gets to keep it.
 *
 * Silent about a viewer who has no queued request. Cancelling nothing leaves the account in the
 * state the person wanted it in either way, and an error page would only be a worse way of
 * saying "you are not being deleted".
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
