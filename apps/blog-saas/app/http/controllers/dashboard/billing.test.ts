import type { MemoryBilling as MemoryBillingType } from "@sdxc/billing/providers/memory";
import type { Database as DatabaseType } from "remix/data-table";
/**
 * Tests the billing page's markup and its one control: the form stays a document
 * submission, because a frame navigation resolved with `fetch` cannot follow the
 * redirect to a hosted page off this origin, and the action answers with that
 * redirect — a hosted checkout for a new account, the portal once one is linked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import billingMiddleware from "@sdxc/billing/middleware";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { createEnv } from "@sdxc/cloudflare-mocks";
import { unwrap } from "@sdxc/result";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { TestDatabase } from "~/app/test/db";

import renderMiddleware from "~/app/http/middleware/render";
import routes from "~/routes/web";

/** Precedes the dynamic import below, since the controller module reads `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		POLAR_ACCESS_TOKEN: "polar-token",
		POLAR_PRODUCT_ID: "product-1",
	}),
	DurableObject: class {},
}));

let { createTestDatabase } = await import("~/app/test/db");
let Account = (await import("~/app/models/account")).default;
let BillingCustomer = (await import("~/app/models/billing-customer")).default;
let { log } = await import("@sdxc/logger/middleware");
let { default: billing } = await import("./billing");

let harness: TestDatabase;
let container: ServiceContainer;
let platform: MemoryBillingType;

beforeEach(() => {
	harness = createTestDatabase();
	container = new ServiceContainer();
	container.instance(Database, harness.db);
	platform = new MemoryBilling({
		catalog: { pro: { amount: 2900, currency: "usd", interval: "month" } },
	});
});

afterEach(() => {
	harness.sqliteDb.close();
});

/**
 * Builds a router serving billing to the given signed-in account, standing in for the
 * session middleware by setting the `Session` the page reads its account id from, and
 * billing against the in-memory platform selling the plan the controller names.
 *
 * @param accountId The account the session presents.
 * @returns The configured router.
 */
function createTestRouter(accountId: string) {
	let session = new Session();
	session.set("accountId", accountId);

	let router = createRouter({
		middleware: [
			log() as Middleware,
			asyncContext(),
			renderMiddleware as Middleware,
			/**
			 * Publishes the session the dashboard guards read, in place of the signed-cookie
			 * middleware the worker installs.
			 */
			(ctx, next) => {
				ctx.set(Session, session, { property: "session" });
				return next();
			},
			billingMiddleware({ provider: platform }),
		],
	});
	router.map(routes.dashboard.billing, billing);

	return router;
}

/** Seeds an account, whose generated id the session then presents. */
async function seedAccount(db: DatabaseType): Promise<string> {
	let account = await Account.findOrCreateFromProfile(db, {
		subject: "auth0|123",
		email: "jane@example.com",
	});
	return account.id;
}

/** Submits the billing form the way the rendered document does. */
function submission(): Request {
	return new Request(`https://blog.test${routes.dashboard.billing.action.href()}`, {
		method: "POST",
		body: new URLSearchParams({ intent: "checkout" }),
	});
}

describe("GET /dashboard/billing", () => {
	test("marks the portal/checkout form as a document submission", async () => {
		let router = createTestRouter(await seedAccount(harness.db));

		let request = new Request(`https://blog.test${routes.dashboard.billing.index.href()}`);
		let response = await container.scope(() => router.fetch(request));
		let body = await response.text();

		let form = body.match(
			new RegExp(`<form[^>]*action="${routes.dashboard.billing.action.href()}"[^>]*>`),
		);
		expect(form?.[0]).toContain("data-rmx-document");
	});
});

describe("POST /dashboard/billing", () => {
	test("sends an account with no customer to a hosted checkout", async () => {
		let router = createTestRouter(await seedAccount(harness.db));

		let response = await container.scope(() => router.fetch(submission()));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toContain("/checkout/");
	});

	test("sends a linked account to the hosted portal", async () => {
		let accountId = await seedAccount(harness.db);
		let customer = await unwrap(
			platform.customers.create({ email: "jane@example.com", externalId: accountId }),
		);
		await BillingCustomer.link(harness.db, accountId, platform.connection, customer.id);
		let router = createTestRouter(accountId);

		let response = await container.scope(() => router.fetch(submission()));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`https://memory.test/portal/${customer.id}`);
	});

	test("returns to the billing page when the platform cannot open a session", async () => {
		let accountId = await seedAccount(harness.db);
		await BillingCustomer.link(harness.db, accountId, platform.connection, "cus_missing");
		let router = createTestRouter(accountId);

		let response = await container.scope(() => router.fetch(submission()));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.dashboard.billing.index.href());
	});
});
