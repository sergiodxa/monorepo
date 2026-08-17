/**
 * Tests `POST /webhooks/polar`: signature rejection, the upsert that records subscription
 * state, the scheduling it applies to the owner's monitors, and everything it deliberately
 * ignores (other event types, other products, an unlinked customer, an out-of-order
 * redelivery).
 *
 * `PolarClient.parseWebhook` is faked in the service container rather than signing a real
 * Standard Webhooks request: verification itself is covered in `@pkg/polar`, and a real
 * signature would also have to satisfy the SDK's full payload schema — the whole
 * subscription, its product, its prices and its meters — which says nothing about this
 * controller. What is tested here is that an unverified payload never reaches the database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarWebhookEvent } from "@pkg/polar";

import { createEnv } from "@pkg/cloudflare-mocks";
import { PolarClient } from "@pkg/polar";
import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { PolarSubscriptionOptions } from "~/app/lib/test/polar";

import Subscription from "~/app/data/subscription";
import { createTestDatabase } from "~/app/lib/test/db";
import { polarSubscription } from "~/app/lib/test/polar";
import { monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ POLAR_WEBHOOK_SECRET: "whsec_test" }),
}));

vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

let { default: polarWebhook } = await import("~/app/http/controllers/webhooks/polar");

type Db = ReturnType<typeof createTestDatabase>["db"];

/**
 * A verified webhook event, as `parseWebhook` would hand one back. The subscription itself
 * comes from the shared fixture; the cast is what stands in for the payload schema the real
 * verifier would have applied to the envelope.
 */
function event(type: string, options: PolarSubscriptionOptions = {}): PolarWebhookEvent {
	let payload = { type, data: polarSubscription(options) };
	return payload as unknown as PolarWebhookEvent;
}

/** A `PolarClient` whose `parseWebhook` is forced to one outcome. */
function fakePolar(outcome: Awaited<ReturnType<PolarClient["parseWebhook"]>>): PolarClient {
	let fake = { parseWebhook: async () => outcome };
	return fake as unknown as PolarClient;
}

async function dispatch(db: Db, polar: PolarClient, body = "{}") {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.webhooks.polar, polarWebhook);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(PolarClient, () => polar);

	return await container.scope(() =>
		router.fetch(
			new Request(`https://uptime.test${routes.webhooks.polar.href()}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
			}),
		),
	);
}

async function createTeamWithMonitor(db: Db, ownerId: string, nextDueAt: number | null) {
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
	test("rejects an unverified payload without touching the projection", async () => {
		let { db } = createTestDatabase();
		let polar = fakePolar(failure(new Error("Invalid Polar webhook signature")));

		let response = await dispatch(db, polar);

		expect(response.status).toBe(400);
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("records an active subscription and schedules the owner's monitors", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createTeamWithMonitor(db, "owner-1", null);
		let polar = fakePolar(success(event("subscription.active")));

		let response = await dispatch(db, polar);

		expect(response.status).toBe(200);
		expect(await Subscription.stateFor(db, "owner-1")).toBe("active");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).not.toBeNull();
	});

	test("unschedules the owner's monitors when the subscription is revoked", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createTeamWithMonitor(db, "owner-1", Date.now());
		let polar = fakePolar(
			success(
				event("subscription.revoked", { status: "canceled", endedAt: "2026-07-20T00:00:00.000Z" }),
			),
		);

		let response = await dispatch(db, polar);

		expect(response.status).toBe(200);
		expect(await Subscription.stateFor(db, "owner-1")).toBe("inactive");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBeNull();
	});

	test("ignores an event that carries no subscription", async () => {
		let { db } = createTestDatabase();
		let polar = fakePolar(success(event("order.paid")));

		let response = await dispatch(db, polar);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ignored: true });
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("ignores a subscription to another product", async () => {
		let { db } = createTestDatabase();
		let polar = fakePolar(success(event("subscription.active", { productId: "prod_other" })));

		let response = await dispatch(db, polar);

		expect(await response.json()).toEqual({ ignored: true });
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("ignores a Polar customer that was never linked to a signed-in subject", async () => {
		let { db } = createTestDatabase();
		let polar = fakePolar(success(event("subscription.active", { externalId: null })));

		let response = await dispatch(db, polar);

		expect(await response.json()).toEqual({ ignored: true });
		expect(await Subscription.listAll(db)).toHaveLength(0);
	});

	test("ignores an out-of-order redelivery instead of rescheduling from a stale status", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createTeamWithMonitor(db, "owner-1", null);

		await dispatch(
			db,
			fakePolar(
				success(
					event("subscription.revoked", {
						status: "canceled",
						modifiedAt: "2026-07-16T00:00:00.000Z",
					}),
				),
			),
		);

		// The `subscription.active` event that preceded it, arriving second.
		let response = await dispatch(db, fakePolar(success(event("subscription.active"))));

		expect(await response.json()).toEqual({ ignored: true });
		expect(await Subscription.stateFor(db, "owner-1")).toBe("inactive");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBeNull();
	});
});
