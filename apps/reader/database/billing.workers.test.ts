/**
 * Drives the billing projection and the delivery endpoint inside workerd: the real D1 this
 * app binds as `PLATFORM_DB`, the shipped migrations as its schema, and the reader's own
 * Durable Object behind the `USER` binding.
 *
 * The platform is `@sdxc/billing`'s in-memory provider rather than a hand-rolled double, so
 * the deliveries a handler is asked about are signed the way a real one is and every
 * snapshot comes back through the contract a real provider implements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MemoryBilling } from "@sdxc/billing/providers/memory";

import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { SyncSource } from "~/app/lib/billing-sync";

import { TIER_PRODUCTS } from "~/app/lib/entitlement";
import feedsSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import billingSql from "~/database/catalog-migrations/0002-billing.sql?raw";
import { userStore } from "~/database/user-do";

/** The base64 secret the provider signs its deliveries with, and the endpoint verifies. */
const WEBHOOK_SECRET = "cmVhZGVyLWJpbGxpbmctd2ViaG9vay1zZWNyZXQ";

/** Where the endpoint is mounted, which is the address the platform is configured with. */
const ENDPOINT = "https://reader.test/webhooks/billing";

/**
 * The platform under test, rebuilt per test from inside the same freshly reset module
 * graph the endpoint is loaded from. Both therefore hold one `BillingError` class, which
 * is what the endpoint reads a retryable failure back through.
 */
let billing: MemoryBilling;

/** How often a handler asked the platform what a customer holds, for the re-read assertion. */
let snapshotReads: string[] = [];

/**
 * Applies one migration through D1's `exec`, which reads a statement per line, so the
 * shipped SQL rather than a schema written for the tests is what the assertions run on.
 */
async function apply(schema: string): Promise<void> {
	let statements = schema
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join(" ")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");

	for (let statement of statements) await env.PLATFORM_DB.exec(`${statement};`);
}

beforeAll(async () => {
	await apply(feedsSql);
	await apply(billingSql);
});

/**
 * Builds the platform and points the module the endpoint and the sync read theirs from at
 * it, so both reach the in-memory provider rather than the configured one. The entitlement
 * read is recorded on the way through, since "the handler asked the platform" is the
 * property every one of these deliveries is judged on.
 */
async function installBilling(): Promise<void> {
	let { MemoryBilling: Memory } = await import("@sdxc/billing/providers/memory");

	billing = new Memory({
		connection: "polar",
		webhookSecret: WEBHOOK_SECRET,
		catalog: {
			[TIER_PRODUCTS.paid]: { amount: 500, interval: "month" },
			[TIER_PRODUCTS.premium]: { amount: 1200, interval: "month" },
		},
	});

	vi.doMock("~/app/lib/billing", () => ({
		CONNECTION: "polar",
		polar: billing.with({
			entitlements: {
				async of(customer) {
					snapshotReads.push("id" in customer ? customer.id : customer.externalId);
					return await billing.entitlements.of(customer);
				},
			},
		}),
		failureFields: (error: unknown) => ({ reason: String(error) }),
	}));
}

/** The endpoint, imported after the platform is installed so it holds the test's provider. */
async function endpoint() {
	let module = await import("~/app/http/controllers/webhooks/billing");
	return module.endpoint;
}

/** The synchronization entry points, imported after the platform is installed. */
async function sync() {
	return await import("~/app/lib/billing-sync");
}

/** A subject no other test in this file uses, since D1 keeps its rows for the whole run. */
function subject(): string {
	return `sub_${crypto.randomUUID()}`;
}

/**
 * A customer holding a settled subscription to one tier, reached the way a reader reaches
 * one: a checkout opened against their subject and then completed.
 *
 * @param externalSubject - The reader's own subject, which becomes the customer's external id.
 * @param product - The tier's product slug.
 */
async function subscribe(externalSubject: string, product: string): Promise<string> {
	let customer = await billing.customers.create({
		email: `${externalSubject}@example.test`,
		externalId: externalSubject,
	});
	if (isFailure(customer)) throw customer.error;

	let checkout = await billing.checkouts.create({
		product,
		customer: { id: customer.data.id },
	});
	if (isFailure(checkout)) throw checkout.error;

	let finished = await billing.checkouts.finish(checkout.data.id);
	if (isFailure(finished)) throw finished.error;

	return customer.data.id;
}

/** One signed delivery, as the request an endpoint receives. */
async function deliver(
	handler: (context: { request: Request }) => Promise<Response> | Response,
	payload: Parameters<MemoryBilling["webhooks"]["emit"]>[0],
): Promise<Response> {
	let delivery = await billing.webhooks.emit(payload);
	if (isFailure(delivery)) throw delivery.error;

	return await handler({ request: delivery.data.request });
}

/** The projected subscription row for a reader, read without going through the registry. */
async function projection(readerSubject: string) {
	return await env.PLATFORM_DB.prepare("select * from subscriptions where subject = ?1")
		.bind(readerSubject)
		.first<Record<string, unknown>>();
}

/** The recorded delivery behind one id, which is what a replay is measured against. */
async function recorded(id: string) {
	return await env.PLATFORM_DB.prepare("select * from billing_webhook_deliveries where id = ?1")
		.bind(id)
		.first<{ valid: number; processed: number; payload: string }>();
}

beforeEach(async () => {
	vi.resetModules();
	snapshotReads = [];

	/**
	 * The projection starts empty for each test. The platform is rebuilt beside it and
	 * numbers its customers from one again, so a row left behind would collide with the
	 * next test's first customer on the index that makes a provider id one reader's.
	 */
	for (let table of ["billing_customers", "subscriptions", "billing_webhook_deliveries"]) {
		await env.PLATFORM_DB.exec(`DELETE FROM ${table};`);
	}

	await installBilling();
});

describe("the delivery endpoint", () => {
	test("a delivery whose signature does not verify is answered 401 and changes nothing", async () => {
		let reader = subject();
		await subscribe(reader, TIER_PRODUCTS.paid);

		let answered = await (
			await endpoint()
		).handler({
			request: new Request(ENDPOINT, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"webhook-id": "forged-1",
					"webhook-timestamp": String(Math.floor(Date.now() / 1000)),
					"webhook-signature": "v1,not-a-signature",
				},
				body: JSON.stringify({ type: "order.paid", data: {} }),
			}),
		} as never);

		expect(answered.status).toBe(401);
		expect(snapshotReads).toEqual([]);
		expect(await projection(reader)).toBeNull();
	});

	test("a delivery is recorded before it is trusted, and processed only once handled", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.paid);
		let held = await billing.subscriptions.list({ customer: { id: customerId } });
		if (isFailure(held)) throw held.error;

		let subscription = held.data.items[0]!;
		let answered = await deliver((await endpoint()).handler as never, {
			id: "delivery-recorded",
			type: "subscription.activated",
			subscription,
		});

		expect(answered.status).toBe(200);

		let row = await recorded("delivery-recorded");

		expect(row?.valid).toBe(1);
		expect(row?.processed).toBe(1);
		expect(JSON.parse(row!.payload)).toMatchObject({ type: "subscription.activated" });
	});

	test("the same delivery arriving twice is dispatched once", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.paid);
		let held = await billing.subscriptions.list({ customer: { id: customerId } });
		if (isFailure(held)) throw held.error;

		let mounted = (await endpoint()).handler as never;
		let payload = {
			id: "delivery-replayed",
			type: "subscription.activated" as const,
			subscription: held.data.items[0]!,
		};

		await deliver(mounted, payload);
		await deliver(mounted, payload);

		expect(snapshotReads).toEqual([customerId]);
	});

	test("a redelivery of one that failed mid-handler is dispatched again", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.paid);
		let held = await billing.subscriptions.list({ customer: { id: customerId } });
		if (isFailure(held)) throw held.error;

		let mounted = (await endpoint()).handler as never;
		let payload = {
			id: "delivery-retried",
			type: "subscription.activated" as const,
			subscription: held.data.items[0]!,
		};

		billing.fail("entitlements", "rate_limited");
		let refused = await deliver(mounted, payload);

		expect(refused.status).toBe(503);
		expect((await recorded("delivery-retried"))?.processed).toBe(0);

		billing.heal();
		let accepted = await deliver(mounted, payload);

		expect(accepted.status).toBe(200);
		expect((await recorded("delivery-retried"))?.processed).toBe(1);
		expect(await userStore(reader).entitlement()).toMatchObject({ tier: "paid" });
	});

	test("a late cancellation for a reader who resubscribed leaves them on their tier", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.paid);
		let held = await billing.subscriptions.list({ customer: { id: customerId } });
		if (isFailure(held)) throw held.error;

		let mounted = (await endpoint()).handler as never;
		let subscription = held.data.items[0]!;

		await deliver(mounted, {
			id: "delivery-activated",
			type: "subscription.activated",
			subscription,
		});

		/**
		 * The delivery says the subscription was cancelled; the platform, asked, says it is
		 * active. The handler carries no state, so what it writes is what the platform says.
		 */
		await deliver(mounted, {
			id: "delivery-late-cancel",
			type: "subscription.canceled",
			subscription: { ...subscription, status: "canceled", cancelAtPeriodEnd: true },
		});

		expect(await userStore(reader).entitlement()).toMatchObject({ tier: "paid" });
		expect(await projection(reader)).toMatchObject({ status: "active" });
	});
});

describe("synchronizing one customer", () => {
	test("a paid checkout names the reader's own subject on the platform's customer", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.paid);

		let state = await billing.entitlements.of({ id: customerId });
		if (isFailure(state)) throw state.error;

		expect(state.data.externalId).toBe(reader);

		let { syncCustomer } = await sync();
		let synced = await syncCustomer(customerId, "webhook" satisfies SyncSource);

		expect(isFailure(synced)).toBe(false);
		expect(await projection(reader)).toMatchObject({
			subject: reader,
			billing_connection: "polar",
			product_slug: TIER_PRODUCTS.paid,
		});
	});

	test("a failed platform read writes no projection row and lowers no tier", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.premium);

		let { syncCustomer } = await sync();
		await syncCustomer(customerId, "webhook");

		expect(await userStore(reader).entitlement()).toMatchObject({ tier: "premium" });

		billing.fail("entitlements", "rate_limited");
		let refused = await syncCustomer(customerId, "sweep");

		expect(isFailure(refused)).toBe(true);
		expect(await userStore(reader).entitlement()).toMatchObject({ tier: "premium" });
		expect(await projection(reader)).toMatchObject({ status: "active" });
	});

	test("a snapshot older than the stored read leaves the projection where it was", async () => {
		let reader = subject();
		let customerId = await subscribe(reader, TIER_PRODUCTS.paid);

		let { syncCustomer } = await sync();
		await syncCustomer(customerId, "webhook");

		let first = await projection(reader);

		await env.PLATFORM_DB.prepare("update subscriptions set checked_at = ?1 where subject = ?2")
			.bind(Number(first!["checked_at"]) + 60_000, reader)
			.run();

		await syncCustomer(customerId, "sweep");

		expect(Number((await projection(reader))!["checked_at"])).toBe(
			Number(first!["checked_at"]) + 60_000,
		);
	});
});

describe("the daily reconciliation", () => {
	test("it walks only the readers holding a billing customer row", async () => {
		let paying = subject();
		let browsing = subject();

		let customerId = await subscribe(paying, TIER_PRODUCTS.paid);

		/** A reader who never opened a checkout, so nothing about them is in the walk. */
		await userStore(browsing).ensureUser(browsing);

		let { reconcileBilling, syncCustomer } = await sync();
		await syncCustomer(customerId, "webhook");

		snapshotReads = [];
		let swept = await reconcileBilling(10);

		expect(snapshotReads).toContain(customerId);
		expect(snapshotReads).not.toContain(browsing);
		expect(swept.failed).toBe(0);
		expect(swept.customers).toBeGreaterThan(0);
	});
});
