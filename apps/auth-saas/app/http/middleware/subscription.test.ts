/**
 * Behavioural tests for the subscription middleware: the billing-gate decision from a
 * tenant's subscription status (active/trialing pass, past_due warns, canceled/unpaid/
 * incomplete redirect to billing), the platform/internal-tenant exemptions, and the
 * missing-context guard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { describe, expect, test, vi } from "vitest";

import subscriptionMiddleware from "./subscription";

/** A no-op logger matching the `context.logger.middleware(...)` shape. */
function fakeLogger() {
	let log = { error() {}, info() {}, warn() {}, debug() {} };
	return { middleware: () => log };
}

/** Builds a request context carrying only what the middleware reads. */
function buildContext(tenant: { id: string; internal: boolean } | undefined) {
	return { tenant, logger: fakeLogger() } as never;
}

/** A `next` that records it ran and returns a sentinel 200 response. */
function passthroughNext() {
	return vi.fn(async () => new Response("passed", { status: 200 }));
}

/**
 * Runs the middleware inside a container scope with `Database` bound to a fake
 * whose `findOne` returns the given subscription row (or null).
 */
async function runWithSubscription(
	tenant: { id: string; internal: boolean },
	subscription: Record<string, unknown> | null,
) {
	let fakeDb = {
		async findOne() {
			return subscription;
		},
	} as unknown as Database;

	let container = new ServiceContainer();
	container.instance(Database, fakeDb);
	let next = passthroughNext();

	let response = await container.scope(() =>
		subscriptionMiddleware(buildContext(tenant), next as never),
	);
	return { response, next };
}

describe("subscription middleware — exemptions", () => {
	test("exempts the platform tenant without a database lookup", async () => {
		let container = new ServiceContainer();
		let next = passthroughNext();

		let response = await container.scope(() =>
			subscriptionMiddleware(buildContext({ id: "platform", internal: false }), next as never),
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	test("exempts an internal tenant without a database lookup", async () => {
		let container = new ServiceContainer();
		let next = passthroughNext();

		let response = await container.scope(() =>
			subscriptionMiddleware(buildContext({ id: "tenant-1", internal: true }), next as never),
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});
});

describe("subscription middleware — guards", () => {
	test("returns 500 when there is no tenant context", async () => {
		let container = new ServiceContainer();
		let next = passthroughNext();

		let response = await container.scope(() =>
			subscriptionMiddleware(buildContext(undefined), next as never),
		);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(500);
	});

	test("redirects to billing when the tenant has no subscription", async () => {
		let { response, next } = await runWithSubscription({ id: "t1", internal: false }, null);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(
			"/dashboard/tenants/t1/billing?blocked=no_subscription",
		);
	});
});

describe("subscription middleware — status gating", () => {
	test("allows access for an active subscription", async () => {
		let { response, next } = await runWithSubscription(
			{ id: "t1", internal: false },
			{ id: "sub1", status: "active" },
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	test("allows access for a trialing subscription", async () => {
		let { response, next } = await runWithSubscription(
			{ id: "t1", internal: false },
			{ id: "sub1", status: "trialing" },
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	test("allows access for a past_due subscription (warning, not blocked)", async () => {
		let { response, next } = await runWithSubscription(
			{ id: "t1", internal: false },
			{ id: "sub1", status: "past_due" },
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	for (let status of ["canceled", "unpaid", "incomplete"]) {
		test(`blocks and redirects a ${status} subscription to billing`, async () => {
			let { response, next } = await runWithSubscription(
				{ id: "t1", internal: false },
				{ id: "sub1", status },
			);

			expect(next).not.toHaveBeenCalled();
			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe(
				`/dashboard/tenants/t1/billing?blocked=${status}`,
			);
		});
	}
});
