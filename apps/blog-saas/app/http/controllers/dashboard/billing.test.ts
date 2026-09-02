/**
 * Tests the billing page's rendered markup. Its only control answers with a redirect
 * to Polar's hosted portal or checkout, so it must stay a document submission: a
 * frame navigation resolved with `fetch` cannot follow a redirect off this origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
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
	env: createEnv<Cloudflare.Env>({ POLAR_PRODUCT_ID: "product-1" }),
	DurableObject: class {},
}));

let { default: billing } = await import("./billing");

/** The account id the seeded session presents, which no seeded row answers to. */
const ACCOUNT_ID = "account-1";

/**
 * Builds a router serving billing to a signed-in viewer, standing in for the session
 * middleware by setting the `Session` the page reads its account id from.
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
	router.map(routes.dashboard.billing, billing);

	return { container, router, sqliteDb };
}

describe("GET /dashboard/billing", () => {
	test("marks the portal/checkout form as a document submission", async () => {
		let { container, router, sqliteDb } = createTestRouter();

		let request = new Request(`https://blog.test${routes.dashboard.billing.index.href()}`);
		let response = await container.scope(() => router.fetch(request));
		let body = await response.text();
		sqliteDb.close();

		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.dashboard.billing.action.href()}"[^>]*>`),
		);
		expect(form?.[0]).toContain("data-rmx-document");
	});
});
