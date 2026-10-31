/**
 * Proves every team action is mapped behind its guards through the real router: an anonymous
 * request is sent to sign in, a viewer outside the team gets a 404, and a plain member gets a
 * 403 from each admin action and each monitor delete; and that public pages, and only they, carry
 * the browser cache policy. Action tests seed the team themselves, so only this one notices a
 * dropped guard.
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
await db.create(
	memberships,
	{ id: generateUUID(), subject_id: "admin-1", team_id: team.id, role: "admin" },
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

/** Deleting a monitor of any kind is an admin's call, though it sits among the member actions. */
let monitorDeletes: Array<[string, Route]> = [
	["actions.monitor.http.delete", routes.actions.monitor.http.delete],
	["actions.monitor.dns.delete", routes.actions.monitor.dns.delete],
	["actions.monitor.tcp.delete", routes.actions.monitor.tcp.delete],
	["actions.monitor.flow.delete", routes.actions.monitor.flow.delete],
	["actions.cronJob.delete", routes.actions.cronJob.delete],
];

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

	test.each([...adminActions, ...monitorDeletes])(
		"%s refuses a plain member with 403",
		async (_, route) => {
			viewer = { id: "member-1", name: "", email: "", avatar: "" };

			let response = await send(route);

			expect(response.status).toBe(403);
			expect(await response.text()).toContain("You do not have permission to perform this action.");
		},
	);

	test.each(monitorDeletes)("%s admits an admin to the action", async (_, route) => {
		viewer = { id: "admin-1", name: "", email: "", avatar: "" };

		let response = await send(route);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).not.toBe(routes.home.href());
	});
});

/** A `GET` through the real router, as the browser sends it for a page or a link prefetch. */
async function get(path: string, headers: HeadersInit = {}): Promise<Response> {
	return router.fetch(new Request(new URL(path, "https://uptime.test"), { headers }));
}

describe("public page caching", () => {
	test.each([
		routes.home.href(),
		routes.marketing.feature.href({ slug: "monitors" }),
		routes.trust.href(),
		routes.docs.show.href({ slug: "overview" }),
	])("%s lets the browser keep the page, with the CSP for its own nonce", async (path) => {
		viewer = null;

		let response = await get(path, { Accept: "text/html" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
		expect(response.headers.get("Vary")).toBe("cookie, accept-language");
		let policy = response.headers.get("Content-Security-Policy-Report-Only") ?? "";
		let nonce = (await response.text()).match(/nonce="([^"]+)"/)?.[1];
		expect(nonce).toBeDefined();
		expect(policy).toContain(`'nonce-${nonce}'`);
	});

	/**
	 * A prefetch marks itself `X-Remix-Frame: true` and the navigation after it does not, so
	 * the stored copy is reusable only when both get the same page under the same policy.
	 * The CSP nonce and each client island's hydration marker are minted per response.
	 */
	test("answers a link prefetch with the page and policy the navigation gets", async () => {
		viewer = null;
		let path = routes.marketing.feature.href({ slug: "monitors" });

		let navigation = await get(path, { Accept: "text/html" });
		let prefetch = await get(path, { Accept: "text/html", "X-Remix-Frame": "true" });

		expect(prefetch.headers.get("Cache-Control")).toBe(navigation.headers.get("Cache-Control"));
		expect(prefetch.headers.get("Vary")).toBe(navigation.headers.get("Vary"));
		let withoutPerResponse = (html: string) => {
			let islands = [...html.matchAll(/<!-- rmx:h:([^ ]+) -->/g)].map((match) => match[1] ?? "");
			return islands
				.reduce((page, id, index) => page.replaceAll(id, `island-${index}`), html)
				.replace(/nonce="[^"]*"/g, 'nonce=""');
		};
		expect(withoutPerResponse(await prefetch.text())).toBe(
			withoutPerResponse(await navigation.text()),
		);
	});

	test("leaves an unknown marketing slug's 404 uncached", async () => {
		viewer = null;

		let response = await get(routes.marketing.feature.href({ slug: "no-such-feature" }));

		expect(response.status).toBe(404);
		expect(response.headers.get("Cache-Control")).toBeNull();
		expect(response.headers.get("Vary")).toBeNull();
	});

	test("leaves a signed-in app page out of the public policy", async () => {
		viewer = { id: "member-1", name: "", email: "", avatar: "" };

		let response = await get(routes.app.team.dashboard.index.href({ team: team.slug }));

		expect(response.headers.get("Cache-Control")).not.toBe("private, max-age=300");
	});
});
