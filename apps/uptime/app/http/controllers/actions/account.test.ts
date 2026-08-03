/**
 * Tests the account-page actions: creating an additional team, leaving a team (with
 * its owner/admin guard rails), and updating the UI language preference. *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, optionalEmails, teams, userPreferences } from "~/database/schema";
import routes from "~/routes/web";

let accountActions = await import("./account");
let createTeam = accountActions.createTeam as RequestHandler;
let leaveTeam = accountActions.leaveTeam as RequestHandler;
let updateEmails = accountActions.updateEmails as RequestHandler;
let updateLanguage = accountActions.updateLanguage as RequestHandler;

/** Installs `ctx.get(Auth)` directly, standing in for the real session-backed `auth()` middleware. */
function viewerMiddleware(viewer: Viewer): Middleware {
	return (ctx, next) => {
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** A loosely-typed view of `router.map` used only to sidestep its route-specific generics
 * when a single test helper maps several differently-shaped routes; the call itself still
 * exercises the real router at runtime. */
type LooseRouterMap = (target: unknown, handler: unknown) => void;

/**
 * Posts a form body to one of the account-page actions through the real action, DB, and service
 * container. A field's value may be a list, since the email-preferences form posts one `emails`
 * value per switch left on and a browser sends those as repeated fields rather than as one.
 */
async function postAccountAction(
	action: RequestHandler,
	route: { href: (params?: never) => string },
	viewer: Viewer,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string | string[]>,
	headers: Record<string, string> = {},
) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let router = createRouter({ middleware: [asyncContext(), formData()] });
	(router.map as LooseRouterMap)(route, {
		middleware: [viewerMiddleware(viewer)],
		handler: action,
	});

	let params = new URLSearchParams();
	for (let [name, value] of Object.entries(body)) {
		for (let entry of Array.isArray(value) ? value : [value]) params.append(name, entry);
	}

	let request = new Request(`https://uptime.test${route.href()}`, {
		method: "POST",
		// Serialized rather than handed over as `URLSearchParams`, because Bun's
		// `URLSearchParams`-backed body stream cannot be read when it is empty — and a form
		// whose every switch is off is exactly an empty body, which the form the actions here
		// are reached from can genuinely post.
		body: params.toString(),
		headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
	});

	return container.scope(() => router.fetch(request));
}

function createViewer(overrides: Partial<Viewer> = {}): Viewer {
	return {
		id: crypto.randomUUID(),
		name: "Ada",
		email: "ada@example.com",
		avatar: "",
		...overrides,
	};
}

async function createTeamRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	overrides: Partial<SelectTeam> = {},
) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function createMembershipRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	teamId: string,
	subjectId: string,
	role: "member" | "admin" = "member",
) {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: subjectId, role },
		{ touch: true, returnRow: true },
	);
}

describe("POST /actions/create-team", () => {
	test("creates a team owned by the viewer and redirects to its dashboard", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			createTeam,
			routes.accountActions.createTeam,
			viewer,
			db,
			{ name: "New Team" },
		);

		let created = await db.findOne(teams, { where: { owner_id: viewer.id } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("New Team");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: created!.slug }),
		);

		let membership = await db.findOne(memberships, {
			where: { team_id: created!.id, subject_id: viewer.id },
		});
		expect(membership?.role).toBe("admin");
	});

	test("rejects a blank name and makes no DB mutation", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			createTeam,
			routes.accountActions.createTeam,
			viewer,
			db,
			{ name: "" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Enter a team name.");
		expect(await db.count(teams, { where: { owner_id: viewer.id } })).toBe(0);
	});
});

describe("POST /actions/leave-team", () => {
	test("removes the viewer's membership and redirects home", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		let team = await createTeamRow(db);
		await createMembershipRow(db, team.id, viewer.id, "member");

		let response = await postAccountAction(leaveTeam, routes.accountActions.leaveTeam, viewer, db, {
			team_id: team.id,
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());

		let membership = await db.findOne(memberships, {
			where: { team_id: team.id, subject_id: viewer.id },
		});
		expect(membership).toBeNull();
	});

	test("404s when the viewer has no membership on the given team, without redirecting", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		let team = await createTeamRow(db);

		let response = await postAccountAction(leaveTeam, routes.accountActions.leaveTeam, viewer, db, {
			team_id: team.id,
		});

		expect(response.status).toBe(404);
	});

	test("blocks the team owner from leaving their own team", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		let team = await createTeamRow(db, { owner_id: viewer.id });
		await createMembershipRow(db, team.id, viewer.id, "admin");

		let response = await postAccountAction(leaveTeam, routes.accountActions.leaveTeam, viewer, db, {
			team_id: team.id,
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("The team owner can't leave the team.");

		let membership = await db.findOne(memberships, {
			where: { team_id: team.id, subject_id: viewer.id },
		});
		expect(membership).not.toBeNull();
	});

	test("blocks a non-owner admin from leaving until they're demoted", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		let team = await createTeamRow(db);
		await createMembershipRow(db, team.id, viewer.id, "admin");

		let response = await postAccountAction(leaveTeam, routes.accountActions.leaveTeam, viewer, db, {
			team_id: team.id,
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Admins must be demoted");

		let membership = await db.findOne(memberships, {
			where: { team_id: team.id, subject_id: viewer.id },
		});
		expect(membership).not.toBeNull();
	});

	test("rejects a request with no team_id and redirects to the Referer, making no DB mutation", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		let team = await createTeamRow(db);
		await createMembershipRow(db, team.id, viewer.id, "member");

		let response = await postAccountAction(
			leaveTeam,
			routes.accountActions.leaveTeam,
			viewer,
			db,
			{ unrelated: "value" },
			{ Referer: "https://uptime.test/app" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("https://uptime.test/app");

		let membership = await db.findOne(memberships, {
			where: { team_id: team.id, subject_id: viewer.id },
		});
		expect(membership).not.toBeNull();
	});
});

/**
 * The action stores the *complement* of what the form posts, so every case here is really about
 * that inversion: the switches say which emails the viewer wants, and the row says which ones we
 * must not send.
 */
describe("POST /actions/update-emails", () => {
	test("stores every optional email the viewer did not ask for", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			updateEmails,
			routes.accountActions.updateEmails,
			viewer,
			db,
			{ emails: "teamDailyDigest" },
			{ Referer: "https://uptime.test/app/acme/account" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("https://uptime.test/app/acme/account");

		let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
		expect(preferences?.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
	});

	test("stores every optional email when the form posts none, since an unchecked switch posts nothing", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			updateEmails,
			routes.accountActions.updateEmails,
			viewer,
			db,
			{},
		);

		// Turning everything off is a legal choice, not a form that failed to validate.
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());

		let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
		expect(preferences?.unsubscribed_emails).toEqual([...optionalEmails]);
	});

	test("clears a stored refusal when the viewer turns an email back on", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		await db.create(
			userPreferences,
			{
				id: crypto.randomUUID(),
				subject_id: viewer.id,
				unsubscribed_emails: ["teamDailyDigest", "teamWeeklyDigest"],
			},
			{ touch: true, returnRow: true },
		);

		await postAccountAction(updateEmails, routes.accountActions.updateEmails, viewer, db, {
			emails: [...optionalEmails],
		});

		// The whole list is replaced rather than added to, so the row is left refusing nothing
		// and one row per subject is all there ever is.
		let rows = await db.findMany(userPreferences, { where: { subject_id: viewer.id } });
		expect(rows).toHaveLength(1);
		expect(rows[0]?.unsubscribed_emails).toEqual([]);
	});

	test("keeps the language preference on the row it shares with the emails", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		await db.create(
			userPreferences,
			{ id: crypto.randomUUID(), subject_id: viewer.id, preferred_language: "es" },
			{ touch: true, returnRow: true },
		);

		await postAccountAction(updateEmails, routes.accountActions.updateEmails, viewer, db, {
			emails: "teamWeeklyDigest",
		});

		let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
		expect(preferences?.preferred_language).toBe("es");
		expect(preferences?.unsubscribed_emails).toEqual(["teamDailyDigest"]);
	});

	test("rejects an email outside the optional list and makes no DB mutation", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			updateEmails,
			routes.accountActions.updateEmails,
			viewer,
			db,
			{ emails: ["teamDailyDigest", "alerts"] },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email preferences.");
		expect(await db.count(userPreferences, { where: { subject_id: viewer.id } })).toBe(0);
	});
});

describe("POST /actions/update-language", () => {
	test("stores the chosen language and sets the language cookie", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			updateLanguage,
			routes.accountActions.updateLanguage,
			viewer,
			db,
			{ language: "es" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(response.headers.get("Set-Cookie")).toContain("uptime:language=");

		let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
		expect(preferences?.preferred_language).toBe("es");
	});

	test("clears the stored preference when 'auto' is chosen", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();
		await db.create(
			userPreferences,
			{ id: crypto.randomUUID(), subject_id: viewer.id, preferred_language: "es" },
			{ touch: true, returnRow: true },
		);

		let response = await postAccountAction(
			updateLanguage,
			routes.accountActions.updateLanguage,
			viewer,
			db,
			{ language: "auto" },
		);

		expect(response.status).toBe(303);

		let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
		expect(preferences?.preferred_language).toBeNull();
	});

	test("rejects a language outside the supported list and makes no DB mutation", async () => {
		let { db } = createTestDatabase();
		let viewer = createViewer();

		let response = await postAccountAction(
			updateLanguage,
			routes.accountActions.updateLanguage,
			viewer,
			db,
			{ language: "xx" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid language.");
		expect(await db.count(userPreferences, { where: { subject_id: viewer.id } })).toBe(0);
	});
});
