/**
 * Unit tests for the `reconcileSubscriptions` job: it repairs drift in both directions (a
 * subscription the platform lists that the projection missed, and a projection row the
 * platform no longer lists), leaves an agreeing projection untouched, logs every repair at
 * error level so a broken delivery stays visible, and drops delivery rows past their
 * retention window.
 *
 * The job imports the configured platform directly, since it runs with no request behind it,
 * so that module is replaced with a real in-memory platform here rather than a client being
 * intercepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, CustomerRef, EntitlementState } from "@pkg/billing";
import type { Result } from "@pkg/result";

import { createJobContext } from "@pkg/jobs";
import { BatchedLogger } from "@pkg/logger";
import { success, unwrap } from "@pkg/result";
import { getTableName } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Subscription from "~/app/data/subscription";
import jobs from "~/app/jobs";
import { Database } from "~/app/jobs/middleware/database";
import { MONITORING_PRODUCT, PING_METER } from "~/app/lib/billing";
import { createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { billingWebhookDeliveries, monitors, teams } from "~/database/schema";

/** Days after which a handled delivery is dropped, as the job is configured. */
const RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The platform under test, created once: the job captures whatever the mock factory returned,
 * so replacing it per test would leave the job on the old one. Each test sells to a fresh
 * subject instead.
 */
let billing = createTestBilling();

/**
 * Lets one test answer the snapshot read itself, for the one state a real platform can hold
 * and the in-memory one cannot: a customer carrying none of our own ids.
 */
let snapshot: ((customer: CustomerRef) => Promise<Result<EntitlementState, never>>) | null = null;

let provider: Billing = {
	...billing,
	entitlements: {
		of: async (customer) =>
			snapshot === null ? await billing.entitlements.of(customer) : await snapshot(customer),
	},
};

vi.doMock("~/app/lib/billing", () => ({
	polar: provider,
	MONITORING_PRODUCT,
	PING_METER,
}));

vi.spyOn(console, "info").mockImplementation(() => {});

let { default: reconcileSubscriptions } = await import("~/app/jobs/reconcile-subscriptions");

type Db = ReturnType<typeof createTestDatabase>["db"];

let db: Db;

/** A subject nothing else in this file has sold to, so the platform's state cannot bleed. */
let ownerId: string;

beforeEach(() => {
	snapshot = null;
	ownerId = `owner-${crypto.randomUUID()}`;
	({ db } = createTestDatabase());
});

async function run() {
	let logger = new BatchedLogger("test");
	let ctx = createJobContext(jobs.reconcileSubscriptions, { id: "message-1", attempts: 1, logger });
	ctx.set(Database, db, { property: "database" });

	await reconcileSubscriptions(ctx);

	return logger;
}

/** Sells the monitoring product to `ownerId` and answers the subscription that created. */
async function subscribe() {
	let customer = await unwrap(
		billing.customers.create({ email: `${ownerId}@example.com`, externalId: ownerId }),
	);

	let opened = await unwrap(
		billing.checkouts.create({ product: MONITORING_PRODUCT, customer: { id: customer.id } }),
	);
	let finished = await unwrap(billing.checkouts.finish(opened.id));

	return await unwrap(billing.subscriptions.find(finished.subscriptionId ?? ""));
}

/** Writes the projection from what the platform currently says, so the two start in step. */
async function projectCurrentState() {
	await Subscription.sync(
		db,
		ownerId,
		await unwrap(billing.entitlements.of({ externalId: ownerId })),
	);
}

async function createTeamWithMonitor(nextDueAt: number | null) {
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

/** Records one delivery at an arbitrary age, which retention is the whole point of. */
async function recordDelivery(id: string, ageDays: number, processed: boolean) {
	let at = Date.now() - ageDays * MS_PER_DAY;

	await db.exec(
		`INSERT INTO ${getTableName(billingWebhookDeliveries)}
		        (id, created_at, updated_at, type, payload, valid, processed)
		 VALUES (?, ?, ?, ?, ?, 1, ?)`,
		[id, at, at, "subscription", "{}", processed ? 1 : 0],
	);
}

function repairedEvent(logger: BatchedLogger) {
	return logger.events.find((entry) => entry.event === "job.reconcile_subscriptions.repaired");
}

describe("reconcileSubscriptions", () => {
	test("repairs nothing when the projection already agrees with the platform", async () => {
		await subscribe();
		await projectCurrentState();

		let logger = await run();

		expect(logger.events.filter((entry) => entry.event.endsWith(".repaired"))).toHaveLength(0);

		let completed = logger.events.find(
			(entry) => entry.event === "job.reconcile_subscriptions.completed",
		);
		expect(completed?.repaired).toBe(0);
		expect(completed?.stored).toBe(1);
	});

	test("records a subscription whose delivery never arrived, and schedules its monitors", async () => {
		let monitor = await createTeamWithMonitor(null);
		await subscribe();

		let logger = await run();

		expect(await Subscription.stateFor(db, ownerId)).toBe("active");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).not.toBeNull();

		expect(repairedEvent(logger)?.entitled).toBe(true);
		expect(repairedEvent(logger)?.level).toBe("error");
	});

	test("unschedules the monitors of a row the platform no longer lists", async () => {
		let monitor = await createTeamWithMonitor(Date.now());
		let subscription = await subscribe();
		await projectCurrentState();

		await unwrap(billing.subscriptions.cancel(subscription.id));

		let logger = await run();

		expect(await Subscription.stateFor(db, ownerId)).toBe("inactive");
		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBeNull();
		expect(repairedEvent(logger)?.entitled).toBe(false);
	});

	test("reports a platform customer that was never linked to a signed-in subject", async () => {
		await subscribe();

		snapshot = async (customer) => {
			let state = await unwrap(billing.entitlements.of(customer));
			return success({ ...state, externalId: null });
		};

		let logger = await run();

		expect(await Subscription.listAll(db)).toHaveLength(0);
		expect(
			logger.events.find(
				(entry) => entry.event === "job.reconcile_subscriptions.unlinked_customer",
			),
		).toBeDefined();
	});

	test("drops handled deliveries past the retention window and keeps the rest", async () => {
		await recordDelivery("old-handled", RETENTION_DAYS + 10, true);
		await recordDelivery("recent-handled", 1, true);
		await recordDelivery("old-unhandled", RETENTION_DAYS + 10, false);

		let logger = await run();

		let kept = (await db.findMany(billingWebhookDeliveries)).map((row) => row.id).sort();
		expect(kept).toEqual(["old-unhandled", "recent-handled"]);

		let completed = logger.events.find(
			(entry) => entry.event === "job.reconcile_subscriptions.completed",
		);
		expect(completed?.pruned).toBe(1);
	});
});
