/**
 * Form actions reached from the account page rather than a specific team's URL
 * scope: creating an additional team, leaving a team, and changing the UI language
 * preference. Each only requires `requireUser` — none take a `:team` route param.
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

import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { language as languageCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import { UpdateLanguageSchema } from "~/app/http/validators/language";
import { CreateTeamSchema, LeaveTeamSchema } from "~/app/http/validators/team";
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
