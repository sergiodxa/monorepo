/**
 * Tests the tenant billing page's rendered markup. Both controls answer with a
 * redirect to Polar's hosted portal or checkout, so each must stay a document
 * submission: a frame navigation resolved with `fetch` cannot follow it off-origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { createEnv } from "@pkg/cloudflare-mocks";
import { logger } from "@pkg/logger/middleware";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import render from "~/app/http/middleware/render";
import Tenant from "~/app/models/tenant";
import routes from "~/routes/web";

/** Precedes the dynamic import below, since the controller module reads `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		CF_ACCOUNT_ID: "account-1",
		CF_API_TOKEN: "token",
		CF_ZONE_ID: "zone-1",
		PLATFORM_DOMAIN: "auth.test",
		POLAR_PRODUCT_ID: "product-1",
	}),
	DurableObject: class {},
}));

let { default: billing } = await import("./billing");

/** The tenant under test, whose id passes the analytics query's UUID check. */
const TENANT_ID = "6d2a7f6c-4a4e-4f2b-9f2a-1c0b5d3e7a91";

/** The signed-in platform user, who owns {@link TENANT_ID}. */
const SUBJECT_ID = "subject-1";

let server = setupServer(
	http.post("https://api.cloudflare.com/client/v4/accounts/:accountId/analytics_engine/sql", () =>
		HttpResponse.json({ data: [{ mau: 0 }] }),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Answers the two reads this page makes, keyed by table so the tenant lookup and the
 * subscription lookup stay independent of the order the page performs them in.
 */
function fakeDatabase(subscription: Record<string, unknown> | null): Database {
	return {
		async findOne(table: unknown) {
			if (table === Tenant.table) {
				return {
					id: TENANT_ID,
					name: "Acme",
					slug: "acme",
					owner_subject_id: SUBJECT_ID,
					region: "weur",
					status: "active",
					internal: false,
				};
			}
			return subscription;
		},
	} as unknown as Database;
}

/**
 * Renders the billing page for an owner whose tenant carries the given subscription,
 * standing in for the session middleware by setting `platformSession` directly.
 */
async function renderBilling(subscription: Record<string, unknown> | null): Promise<string> {
	let container = new ServiceContainer();
	container.instance(Database, fakeDatabase(subscription));

	let router = createRouter({
		middleware: [
			logger,
			asyncContext(),
			render as Middleware,
			(ctx, next) => {
				ctx.platformSession = { subjectId: SUBJECT_ID, email: "owner@example.com" };
				return next();
			},
		],
	});
	router.map(routes.dashboard.tenants.billing, billing);

	let request = new Request(
		`https://auth.test${routes.dashboard.tenants.billing.index.href({ tenantId: TENANT_ID })}`,
	);
	let response = await container.scope(() => router.fetch(request));
	return await response.text();
}

/** The billing action's own path, which both forms post to with an `action` query. */
let action = routes.dashboard.tenants.billing.action.href({ tenantId: TENANT_ID });

describe("GET /dashboard/tenants/:tenantId/billing", () => {
	test("marks the billing-portal form as a document submission", async () => {
		let body = await renderBilling({ id: "sub-1", status: "active", polar_customer_id: "cus-1" });

		let form = body.match(new RegExp(`<form[^>]*action="${action}\\?action=portal"[^>]*>`));
		expect(form?.[0]).toContain("data-rmx-document");
	});

	test("marks the checkout form as a document submission", async () => {
		let body = await renderBilling(null);

		let form = body.match(new RegExp(`<form[^>]*action="${action}\\?action=checkout"[^>]*>`));
		expect(form?.[0]).toContain("data-rmx-document");
	});
});
