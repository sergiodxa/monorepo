/**
 * Tests `POST /webhooks/polar`: the signature check, the snapshot it writes into the
 * projection, the scheduling it applies to the owner's monitors, the delivery it records
 * before trusting anything, and everything it deliberately acknowledges without acting on
 * (an event type it has no handler for, a subscription to another product, a redelivery).
 *
 * Deliveries come from a real in-memory platform, which signs them the way the endpoint
 * verifies them, so the signature check and the snapshot read are both the real ones and a
 * test arranges state by selling a subscription rather than by writing columns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import logger from "@sdxc/logger/middleware";
import { unwrap } from "@sdxc/result";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Subscription from "~/app/data/subscription";
import { MONITORING_PRODUCT, PING_METER } from "~/app/lib/billing";
import { createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { billingWebhookDeliveries, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/** Another thing the organization sells, so a delivery about it can be shown to be ignored. */
const OTHER_PRODUCT = "ebook";

/**
 * The platform the endpoint is built against, created once: the endpoint captures it at its
 * own module scope, so replacing it per test would leave the endpoint on the old one. Each
 * test sells to a fresh customer instead.
 */
let billing = createTestBilling();

billing.seed({ [OTHER_PRODUCT]: { amount: 1900, currency: "usd", interval: "year" } });

vi.doMock("~/app/lib/billing", () => ({
	polar: billing,
	MONITORING_PRODUCT,
	PING_METER,
}));

vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

let { default: polarWebhook } = await import("~/app/http/controllers/webhooks/polar");

type Db = ReturnType<typeof createTestDatabase>["db"];

let db: Db;

/** A subject nothing else in this file has sold to, so the platform's state cannot bleed. */
let ownerId: string;

beforeEach(() => {
	ownerId = `owner-${crypto.randomUUID()}`;
	({ db } = createTestDatabase());
});

/**
 * Sells `product` to a fresh customer and hands back what the platform now holds, which is
 * the state every delivery below is about.
 */
async function subscribe(externalId: string, product = MONITORING_PRODUCT) {
	let customer = await unwrap(
		billing.customers.create({ email: `${externalId}@example.com`, externalId }),
	);

	let opened = await unwrap(billing.checkouts.create({ product, customer: { id: customer.id } }));
	let finished = await unwrap(billing.checkouts.finish(opened.id));
	let subscription = await unwrap(billing.subscriptions.find(finished.subscriptionId ?? ""));

	return { customer, subscription };
}

/**
 * Posts one delivery at this app's own webhook path, keeping the headers and the exact bytes
 * the platform signed — the URL is the only thing the endpoint does not read.
 */
async function dispatch(delivery: { body: string; headers: Headers }) {
	let router = createRouter({ middleware: [asyncContext(), logger] });
	router.map(routes.webhooks.polar, polarWebhook);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return await container.scope(() =>
		router.fetch(
			new Request(`https://uptime.test${routes.webhooks.polar.href()}`, {
				method: "POST",
				headers: delivery.headers,
				body: delivery.body,
			}),
		),
	);
}

async function createTeamWithMonitor(ownerId: string, nextDueAt: number | null) {
	let team = await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: ownerId,
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);

	let monitor = await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			author_id: "author-1",
			name: "Site",
			url: "https://example.com",
			interval_seconds: 60,
			enabled_at: Date.now(),
			next_due_at: nextDueAt,
		},
		{ touch: true, returnRow: true },
	);

	return { team, monitor };
}

describe("POST /webhooks/polar", () => {
	test("rejects an unsigned payload without touching the projection", async () => {
		let { subscription } = await subscribe(ownerId);
		let delivery = await unwrap(
			billing.webhooks.emit({ type: "subscription.activated", subscription }),
		);

		let response = await dispatch({ body: delivery.body, headers: new Headers() });

		expect(response.status).toBe(401);
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("records the delivery with its verdict even when the signature fails", async () => {
		let { subscription } = await subscribe(ownerId);
		let delivery = await unwrap(
			billing.webhooks.emit({ type: "subscription.activated", subscription }),
		);

		await dispatch({ body: delivery.body, headers: new Headers() });

		let [row] = await db.findMany(billingWebhookDeliveries);
		expect(row?.valid).toBe(0);
		expect(row?.processed).toBe(0);
		expect(row?.payload).toBe(delivery.body);
	});

	test("records an active subscription and schedules the owner's monitors", async () => {
		let { monitor } = await createTeamWithMonitor(ownerId, null);
		let { subscription } = await subscribe(ownerId);
		let delivery = await unwrap(
			billing.webhooks.emit({ type: "subscription.activated", subscription }),
		);

		let response = await dispatch(delivery);

		expect(response.status).toBe(200);
		expect(await Subscription.stateFor(db, ownerId)).toBe("active");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).not.toBeNull();

		let [row] = await db.findMany(billingWebhookDeliveries);
		expect(row?.valid).toBe(1);
		expect(row?.processed).toBe(1);
	});

	test("unschedules the owner's monitors once the subscription is gone", async () => {
		let { monitor } = await createTeamWithMonitor(ownerId, Date.now());
		let { subscription } = await subscribe(ownerId);

		await dispatch(
			await unwrap(billing.webhooks.emit({ type: "subscription.activated", subscription })),
		);
		await unwrap(billing.subscriptions.cancel(subscription.id));

		let response = await dispatch(
			await unwrap(billing.webhooks.emit({ type: "subscription.revoked", subscription })),
		);

		expect(response.status).toBe(200);
		expect(await Subscription.stateFor(db, ownerId)).toBe("inactive");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBeNull();
	});

	test("acknowledges an event type it has no handler for", async () => {
		let response = await dispatch(
			await unwrap(
				billing.webhooks.emit({ type: "unrecognized", providerType: "benefit.granted" }),
			),
		);

		expect(response.status).toBe(200);
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("records nothing for a subscription to another product", async () => {
		let { subscription } = await subscribe(ownerId, OTHER_PRODUCT);

		let response = await dispatch(
			await unwrap(billing.webhooks.emit({ type: "subscription.activated", subscription })),
		);

		expect(response.status).toBe(200);
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("acknowledges a redelivery without running the handler again", async () => {
		let { monitor } = await createTeamWithMonitor(ownerId, null);
		let { subscription } = await subscribe(ownerId);
		let delivery = await unwrap(
			billing.webhooks.emit({ type: "subscription.activated", subscription }),
		);

		await dispatch(delivery);

		/**
		 * The subscription ends between the two deliveries. A redelivery that re-read the
		 * snapshot would unschedule the monitor, so the monitor still being scheduled is what
		 * proves the second delivery was skipped rather than replayed.
		 */
		await unwrap(billing.subscriptions.cancel(subscription.id));

		let response = await dispatch(delivery);

		expect(response.status).toBe(200);
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).not.toBeNull();
		expect(await db.findMany(billingWebhookDeliveries)).toHaveLength(1);
	});

	test("acknowledges a delivery about a customer the platform no longer holds", async () => {
		let { subscription } = await subscribe(ownerId);
		let delivery = await unwrap(
			billing.webhooks.emit({
				type: "subscription.activated",
				subscription: { ...subscription, customerId: "cus_missing" },
			}),
		);

		let response = await dispatch(delivery);

		expect(response.status).toBe(200);
		expect(await Subscription.listAll(db)).toHaveLength(0);

		/** Left unprocessed on purpose, so the trail shows a delivery this app never acted on. */
		let [row] = await db.findMany(billingWebhookDeliveries);
		expect(row?.processed).toBe(0);
	});
});
