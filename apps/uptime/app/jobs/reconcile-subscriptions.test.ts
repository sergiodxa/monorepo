/**
 * Unit tests for `ReconcileSubscriptionsJob.perform`: it repairs drift in both directions
 * (a subscription Polar lists as active that the projection missed, and a projection row
 * Polar no longer lists), leaves an agreeing projection untouched, and logs every repair at
 * error level so a broken webhook delivery stops being silent.
 *
 * Polar is faked through the service container, the way `app/data/monitor.test.ts` fakes it:
 * `PolarClient` is a container singleton, so a double is registered instead of a request
 * being intercepted, and no `fetch` is involved either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subscription as PolarSubscription } from "@pkg/polar";

import { BatchedLogger } from "@pkg/logger";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Subscription from "~/app/data/subscription";
import { ReconcileSubscriptionsJob } from "~/app/jobs/reconcile-subscriptions";
import { createTestDatabase } from "~/app/lib/test/db";
import { polarSubscription } from "~/app/lib/test/polar";
import { monitors, teams } from "~/database/schema";

type Db = ReturnType<typeof createTestDatabase>["db"];

vi.spyOn(console, "info").mockImplementation(() => {});

let db: Db;

beforeEach(() => {
	({ db } = createTestDatabase());
});

/** A `PolarClient` answering only the two reads reconciliation performs. */
function fakePolar(live: PolarSubscription[], byId: Record<string, PolarSubscription> = {}) {
	let fake = {
		listActiveSubscriptionsByProduct: async () => live,
		getSubscription: async (id: string) => {
			let found = byId[id];
			if (!found) throw new Error(`unexpected getSubscription(${id})`);
			return found;
		},
	};

	return fake as unknown as PolarClient;
}

async function run(polar: PolarClient) {
	let logger = new BatchedLogger("test");
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(PolarClient, () => polar);

	await container.scope(async () => {
		let job = new ReconcileSubscriptionsJob({ logger }, {});
		await job.perform();
	});

	return logger;
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

	return await db.create(
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
}

describe("ReconcileSubscriptionsJob.perform", () => {
	test("repairs nothing when the projection already agrees with Polar", async () => {
		await Subscription.upsert(db, "owner-1", polarSubscription());

		let logger = await run(fakePolar([polarSubscription()]));

		expect(logger.events.filter((entry) => entry.event.endsWith(".repaired"))).toHaveLength(0);
		let completed = logger.events.find(
			(entry) => entry.event === "job.reconcile_subscriptions.completed",
		);
		expect(completed?.repaired).toBe(0);
		expect(completed?.live).toBe(1);
		expect(completed?.stored).toBe(1);
	});

	test("records a subscription whose webhook never arrived, and schedules its monitors", async () => {
		let monitor = await createTeamWithMonitor("owner-1", null);

		let logger = await run(fakePolar([polarSubscription()]));

		expect(await Subscription.stateFor(db, "owner-1")).toBe("active");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).not.toBeNull();

		let repaired = logger.events.find(
			(entry) => entry.event === "job.reconcile_subscriptions.repaired",
		);
		expect(repaired?.entitled).toBe(true);
		expect(repaired?.level).toBe("error");
	});

	test("re-reads Polar for a row it no longer lists, and unschedules those monitors", async () => {
		let monitor = await createTeamWithMonitor("owner-1", Date.now());
		await Subscription.upsert(db, "owner-1", polarSubscription());

		let ended = polarSubscription({ status: "canceled", modifiedAt: "2026-07-20T00:00:00.000Z" });
		let logger = await run(fakePolar([], { sub_1: ended }));

		expect(await Subscription.stateFor(db, "owner-1")).toBe("inactive");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBeNull();

		let repaired = logger.events.find(
			(entry) => entry.event === "job.reconcile_subscriptions.repaired",
		);
		expect(repaired?.entitled).toBe(false);
	});

	test("reports a Polar customer that was never linked to a signed-in subject", async () => {
		let logger = await run(fakePolar([polarSubscription({ externalId: null })]));

		expect(await Subscription.listAll(db)).toHaveLength(0);
		expect(
			logger.events.find(
				(entry) => entry.event === "job.reconcile_subscriptions.unlinked_customer",
			),
		).toBeDefined();
	});
});
