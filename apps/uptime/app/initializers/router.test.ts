/**
 * Proves every team action is mapped behind its guards through the real router: an anonymous
 * request is sent to sign in, a viewer outside the team gets a 404, and a plain member gets a
 * 403 from each admin action. Action tests seed the team themselves, so only this one notices a dropped guard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Route } from "remix/routes";

import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import { createTestDatabase } from "~/app/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/** Who the next request is signed in as, read by the auth module this file installs. */
let viewer: Viewer | null = null;

let { db } = createTestDatabase();

vi.doMock("~/app/http/middleware/auth", () => {
	let passThrough = (_ctx: unknown, next: () => Promise<Response>) => next();
	return {
		auth: passThrough,
		default: passThrough,
		getViewer: () => viewer,
		isAuthenticated: () => viewer !== null,
	};
});
vi.doMock("~/app/http/middleware/session", () => ({
	createSessionMiddleware: () =>
		session(createCookie("uptime-test", { secrets: ["test"] }), createMemorySessionStorage()),
}));
vi.doMock("~/app/initializers/database", () => ({ openDatabase: () => db }));
vi.doMock("cloudflare:sockets", () => ({
	connect: () => {
		throw new Error("A guarded action opened a socket");
	},
}));

let { createWebRouter } = await import("~/app/initializers/router");

let router = createWebRouter({ kv: env.KV, cookieSecret: "test", secure: false });

let team = await db.create(
	teams,
	{ id: generateUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
	{ touch: true, returnRow: true },
);
await db.create(
	memberships,
	{ id: generateUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
	{ touch: true },
);

/** Every leaf route under a route-map group, with its dotted name for the test title. */
function leaves(group: object, prefix: string): Array<[string, Route]> {
	return Object.entries(group).flatMap(([key, value]): Array<[string, Route]> => {
		let name = `${prefix}.${key}`;
		if (typeof value === "object" && value !== null && "href" in value && "method" in value) {
			return [[name, value as Route]];
		}
		return leaves(value as object, name);
	});
}

/** Sends the route's own method, from the app's origin so cross-origin protection lets it through. */
async function send(route: Route): Promise<Response> {
	let url = new URL(route.href({ team: team.slug }), "https://uptime.test");
	return router.fetch(
		new Request(url, {
			method: route.method === "ANY" ? "POST" : route.method,
			headers: { Origin: url.origin },
			body: new FormData(),
		}),
	);
}

let memberActions = leaves(routes.actions, "actions");
let adminActions = leaves(routes.teamAdminActions, "teamAdminActions");

describe("team action guards", () => {
	test.each([...memberActions, ...adminActions])(
		"%s sends an anonymous visitor to sign in",
		async (_, route) => {
			viewer = null;

			let response = await send(route);

			expect(response.status).toBe(303);
			expect(response.headers.get("Location")).toBe(routes.home.href());
		},
	);

	test.each([...memberActions, ...adminActions])(
		"%s answers 404 to a viewer outside the team",
		async (_, route) => {
			viewer = { id: "stranger-1", name: "", email: "", avatar: "" };

			let response = await send(route);

			expect(response.status).toBe(404);
		},
	);

	test.each(adminActions)("%s refuses a plain member with 403", async (_, route) => {
		viewer = { id: "member-1", name: "", email: "", avatar: "" };

		let response = await send(route);

		expect(response.status).toBe(403);
		expect(await response.text()).toContain("You do not have permission to perform this action.");
	});
});
