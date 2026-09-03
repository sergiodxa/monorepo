/**
 * Tests the dashboard landing page's rendered markup. Its sign-out form answers with
 * a redirect to the provider's end-session endpoint, so it must stay a document
 * submission: a frame navigation resolved with `fetch` cannot follow it off-origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { describe, expect, test, vi } from "vitest";

import renderMiddleware from "~/app/http/middleware/render";
import { createTestDatabase } from "~/app/test/db";
import routes from "~/routes/web";

/** Precedes the dynamic import below, since the controller module reads `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ PLATFORM_DOMAIN: "blog.test" }),
	DurableObject: class {},
}));

let { default: dashboardIndex } = await import("./index");

/** The account id the seeded session presents, which no seeded row answers to. */
const ACCOUNT_ID = "account-1";

/**
 * Builds a router serving the dashboard to a signed-in viewer, standing in for the
 * session middleware by setting the `Session` the page reads its account id from.
 */
function createTestRouter() {
	let { db, sqliteDb } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let session = new Session();
	session.set("accountId", ACCOUNT_ID);

	let router = createRouter({
		middleware: [
			asyncContext(),
			renderMiddleware as Middleware,
			(ctx, next) => {
				ctx.set(Session, session, { property: "session" });
				return next();
			},
		],
	});
	router.map(routes.dashboard.index, dashboardIndex);

	return { container, router, sqliteDb };
}

describe("GET /dashboard", () => {
	test("marks the sign-out form as a document submission", async () => {
		let { container, router, sqliteDb } = createTestRouter();

		let request = new Request(`https://blog.test${routes.dashboard.index.href()}`);
		let response = await container.scope(() => router.fetch(request));
		let body = await response.text();
		sqliteDb.close();

		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.auth.logout.action.href()}"[^>]*>`),
		);
		expect(form?.[0]).toContain("data-rmx-document");
	});
});
