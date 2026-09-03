/**
 * Tests the `/app` entry redirect: an anonymous visitor is bounced home by the baked-in
 * `requireUser` guard, a signed-in viewer is redirected to their first team's URL, and
 * a signed-in viewer with no team membership at all throws (the docblock's "sign-in
 * always provisions or joins one" assumption failing).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import appIndex from "./index";

/** Sets the `Auth` context state directly, standing in for the real session-backed `auth` middleware. */
function seedAuth(viewer: Viewer | null): Middleware {
	return (ctx, next) => {
		if (viewer) ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		else ctx.set(Auth, { ok: false });
		return next();
	};
}

/** Dispatches a real GET request to `/app` for the given signed-in state. */
async function getAppIndex(db: ReturnType<typeof createTestDatabase>["db"], viewer: Viewer | null) {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext(), seedAuth(viewer)] });
	router.map(routes.app.index, appIndex);

	let request = new Request(`https://uptime.test${routes.app.index.href()}`);
	return container.scope(() => router.fetch(request));
}

let VIEWER: Viewer = { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", avatar: "" };

describe("GET /app", () => {
	test("redirects an anonymous visitor home", async () => {
		let { db } = createTestDatabase();

		let response = await getAppIndex(db, null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
	});

	test("redirects a signed-in viewer to their first team's URL", async () => {
		let { db } = createTestDatabase();
		let team = await db.create(
			teams,
			{
				id: crypto.randomUUID(),
				owner_id: VIEWER.id,
				name: "Ada's Team",
				slug: "ada-team",
				logo: null,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: VIEWER.id, team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		let response = await getAppIndex(db, VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.team.index.href({ team: team.slug }));
	});

	test("throws when a signed-in viewer has no team membership at all", async () => {
		let { db } = createTestDatabase();

		await expect(getAppIndex(db, VIEWER)).rejects.toThrow(
			`Viewer ${VIEWER.id} has no team membership`,
		);
	});
});
