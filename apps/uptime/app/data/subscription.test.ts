/**
 * Unit tests for the `Subscription` projection model: the upsert's idempotency and its
 * out-of-order guard, the three-state entitlement read, and the scheduling write that
 * replaces the every-minute subscription check. Runs against the in-memory SQLite
 * database with every migration applied, so the raw upsert and the cross-table
 * `next_due_at` writes are exercised as real SQL.
 *
 * The last test is the behaviour ADR-005 inverts: an owner nothing is known about keeps
 * being claimed by the sweep, instead of being silently dropped from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import Subscription, { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";
import { claimDue } from "~/app/lib/scheduling";
import { createTestDatabase } from "~/app/lib/test/db";
import { polarSubscription } from "~/app/lib/test/polar";
import { dnsMonitors, monitors, tcpMonitors, teams } from "~/database/schema";

type Db = ReturnType<typeof createTestDatabase>["db"];

/** `stateFor` logs every unknown owner; silenced so the suite's output stays readable. */
vi.spyOn(console, "info").mockImplementation(() => {});

let db: Db;

beforeEach(() => {
	({ db } = createTestDatabase());
});

async function createTeam(db: Db, ownerId: string) {
	return await db.create(
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
}

async function createMonitor(db: Db, teamId: string, changes: Record<string, unknown> = {}) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			author_id: "author-1",
			name: "Site",
			url: "https://example.com",
			interval_seconds: 60,
			enabled_at: Date.now(),
			next_due_at: Date.now(),
			...changes,
		},
		{ touch: true, returnRow: true },
	);
}

describe("Subscription.upsert", () => {
	test("maps a Polar payload onto the projection's columns", async () => {
		expect(await Subscription.upsert(db, "owner-1", polarSubscription())).toBe(true);

		let [row] = await Subscription.listAll(db);
		expect(row?.external_customer_id).toBe("owner-1");
		expect(row?.polar_subscription_id).toBe("sub_1");
		expect(row?.polar_product_id).toBe(SUBSCRIPTION_PRODUCT_ID);
		expect(row?.status).toBe("active");
		expect(row?.current_period_end).toBe(new Date("2026-08-01T00:00:00.000Z").getTime());
		expect(row?.revoked_at).toBeNull();
		expect(row?.polar_modified_at).toBe(new Date("2026-07-15T00:00:00.000Z").getTime());
	});

	test("records when Polar ended the subscription", async () => {
		await Subscription.upsert(
			db,
			"owner-1",
			polarSubscription({ status: "canceled", endedAt: "2026-07-20T00:00:00.000Z" }),
		);

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("canceled");
		expect(row?.revoked_at).toBe(new Date("2026-07-20T00:00:00.000Z").getTime());
	});

	test("is idempotent: a redelivered event updates the same row", async () => {
		await Subscription.upsert(db, "owner-1", polarSubscription());
		expect(await Subscription.upsert(db, "owner-1", polarSubscription())).toBe(true);

		expect(await Subscription.listAll(db)).toHaveLength(1);
	});

	test("applies a newer payload", async () => {
		await Subscription.upsert(db, "owner-1", polarSubscription());

		expect(
			await Subscription.upsert(
				db,
				"owner-1",
				polarSubscription({ status: "canceled", modifiedAt: "2026-07-16T00:00:00.000Z" }),
			),
		).toBe(true);

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("canceled");
	});

	test("refuses an older payload, so out-of-order deliveries can't roll state back", async () => {
		await Subscription.upsert(
			db,
			"owner-1",
			polarSubscription({ status: "canceled", modifiedAt: "2026-07-16T00:00:00.000Z" }),
		);

		expect(await Subscription.upsert(db, "owner-1", polarSubscription({ status: "active" }))).toBe(
			false,
		);

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("canceled");
		expect(await Subscription.listAll(db)).toHaveLength(1);
	});

	test("falls back to the creation time when Polar reports no modification time", async () => {
		await Subscription.upsert(db, "owner-1", polarSubscription({ modifiedAt: null }));

		let [row] = await Subscription.listAll(db);
		expect(row?.polar_modified_at).toBe(new Date("2026-07-01T00:00:00.000Z").getTime());
	});
});

describe("Subscription.stateFor", () => {
	test("is unknown when the projection has never heard of the owner", async () => {
		expect(await Subscription.stateFor(db, "owner-1")).toBe("unknown");
		expect(await Subscription.isActive(db, "owner-1")).toBe(false);
	});

	test("is active when a recorded subscription is in an active status", async () => {
		await Subscription.upsert(db, "owner-1", polarSubscription({ status: "trialing" }));

		expect(await Subscription.stateFor(db, "owner-1")).toBe("active");
		expect(await Subscription.isActive(db, "owner-1")).toBe(true);
	});

	test("is inactive — not unknown — once a lapsed subscription is on record", async () => {
		await Subscription.upsert(db, "owner-1", polarSubscription({ status: "canceled" }));

		expect(await Subscription.stateFor(db, "owner-1")).toBe("inactive");
		expect(await Subscription.isActive(db, "owner-1")).toBe(false);
	});

	test("ignores another owner's subscription", async () => {
		await Subscription.upsert(db, "owner-2", polarSubscription());

		expect(await Subscription.stateFor(db, "owner-1")).toBe("unknown");
	});
});

describe("Subscription.applyEntitlement", () => {
	test("unschedules every monitor type the owner's teams hold", async () => {
		let team = await createTeam(db, "owner-1");
		let monitor = await createMonitor(db, team.id);
		let tcp = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "SSH",
				host: "example.com",
				port: 22,
				next_due_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
		let dns = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Apex",
				domain: "example.com",
				next_due_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		expect(await Subscription.applyEntitlement(db, "owner-1", false)).toBe(3);

		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBeNull();
		expect((await db.findOne(tcpMonitors, { where: { id: tcp.id } }))?.next_due_at).toBeNull();
		expect((await db.findOne(dnsMonitors, { where: { id: dns.id } }))?.next_due_at).toBeNull();
	});

	test("leaves another owner's monitors alone", async () => {
		let mine = await createTeam(db, "owner-1");
		let theirs = await createTeam(db, "owner-2");
		await createMonitor(db, mine.id);
		let other = await createMonitor(db, theirs.id);

		expect(await Subscription.applyEntitlement(db, "owner-1", false)).toBe(1);

		expect((await db.findOne(monitors, { where: { id: other.id } }))?.next_due_at).not.toBeNull();
	});

	test("reschedules only the monitors the user has enabled", async () => {
		let team = await createTeam(db, "owner-1");
		let enabled = await createMonitor(db, team.id, { next_due_at: null });
		let disabled = await createMonitor(db, team.id, { enabled_at: null, next_due_at: null });

		expect(await Subscription.applyEntitlement(db, "owner-1", true)).toBe(1);

		expect((await db.findOne(monitors, { where: { id: enabled.id } }))?.next_due_at).not.toBeNull();
		expect((await db.findOne(monitors, { where: { id: disabled.id } }))?.next_due_at).toBeNull();
	});

	test("skips rows already unscheduled, so a redelivered revoke writes nothing", async () => {
		let team = await createTeam(db, "owner-1");
		await createMonitor(db, team.id);

		expect(await Subscription.applyEntitlement(db, "owner-1", false)).toBe(1);
		expect(await Subscription.applyEntitlement(db, "owner-1", false)).toBe(0);
	});

	test("leaves an already-scheduled monitor's cadence where it is", async () => {
		let team = await createTeam(db, "owner-1");
		let dueAt = Date.now() + 30_000;
		let monitor = await createMonitor(db, team.id, { next_due_at: dueAt });

		expect(await Subscription.applyEntitlement(db, "owner-1", true)).toBe(0);

		expect((await db.findOne(monitors, { where: { id: monitor.id } }))?.next_due_at).toBe(dueAt);
	});
});

describe("the sweep and unknown subscription state", () => {
	test("still claims a monitor whose owner's subscription state is unknown", async () => {
		let team = await createTeam(db, "owner-1");
		let monitor = await createMonitor(db, team.id, { next_due_at: Date.now() - 1000 });

		// Nothing was ever recorded for this owner, which is the state that used to make the
		// scheduler skip them: `filterActiveSubscribers` failed closed on it.
		expect(await Subscription.stateFor(db, "owner-1")).toBe("unknown");
		expect(await Subscription.listAll(db)).toHaveLength(0);

		let claimed = await claimDue(db, monitors, ["id"], Date.now());

		expect(claimed.map((row) => row.id)).toEqual([monitor.id]);
	});
});
