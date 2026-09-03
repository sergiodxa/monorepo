/**
 * Unit tests for the `Subscription` projection model: the snapshot write's idempotency and its
 * out-of-order guard, the three-state entitlement read, the scheduling write, and the
 * sweep still claiming an owner nothing is known about. Runs against in-memory SQLite
 * with every migration applied, so the raw upsert and the cross-table `next_due_at`
 * writes are exercised as real SQL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import Subscription from "~/app/data/subscription";
import { MONITORING_PRODUCT } from "~/app/lib/billing";
import { claimDue } from "~/app/lib/scheduling";
import { emptyEntitlementState, entitlementState } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
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

describe("Subscription.sync", () => {
	test("maps a snapshot onto the projection's columns", async () => {
		let synced = await Subscription.sync(db, "owner-1", entitlementState());

		expect(synced).toEqual({ applied: true, changed: true, entitled: true });

		let [row] = await Subscription.listAll(db);
		expect(row?.external_customer_id).toBe("owner-1");
		expect(row?.billing_subscription_id).toBe("sub_1");
		expect(row?.billing_product_slug).toBe(MONITORING_PRODUCT);
		expect(row?.status).toBe("active");
		expect(row?.current_period_end).toBe(new Date("2026-08-01T00:00:00.000Z").getTime());
		expect(row?.revoked_at).toBeNull();
		expect(row?.billing_read_at).toBe(new Date("2026-07-15T00:00:00.000Z").getTime());
	});

	test("keeps a status the platform still reports, ended period and all", async () => {
		await Subscription.sync(db, "owner-1", entitlementState({ status: "canceled" }));

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("canceled");
		expect(row?.revoked_at).toBeNull();
	});

	test("revokes a subscription the snapshot stopped listing, rather than deleting it", async () => {
		await Subscription.sync(db, "owner-1", entitlementState());

		let synced = await Subscription.sync(
			db,
			"owner-1",
			emptyEntitlementState({ readAt: "2026-07-20T00:00:00.000Z" }),
		);

		expect(synced).toEqual({ applied: true, changed: true, entitled: false });

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("revoked");
		expect(row?.revoked_at).toBe(new Date("2026-07-20T00:00:00.000Z").getTime());
	});

	test("is idempotent: a re-read updates the same row and reports no change", async () => {
		await Subscription.sync(db, "owner-1", entitlementState());

		expect(await Subscription.sync(db, "owner-1", entitlementState())).toEqual({
			applied: true,
			changed: false,
			entitled: true,
		});

		expect(await Subscription.listAll(db)).toHaveLength(1);
	});

	test("applies a fresher snapshot", async () => {
		await Subscription.sync(db, "owner-1", entitlementState());

		expect(
			await Subscription.sync(
				db,
				"owner-1",
				entitlementState({ status: "past_due", readAt: "2026-07-16T00:00:00.000Z" }),
			),
		).toEqual({ applied: true, changed: true, entitled: false });

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("past_due");
	});

	test("refuses an older snapshot, so a slower read can't roll state back", async () => {
		await Subscription.sync(
			db,
			"owner-1",
			entitlementState({ status: "past_due", readAt: "2026-07-16T00:00:00.000Z" }),
		);

		expect(await Subscription.sync(db, "owner-1", entitlementState())).toMatchObject({
			applied: false,
		});

		let [row] = await Subscription.listAll(db);
		expect(row?.status).toBe("past_due");
		expect(await Subscription.listAll(db)).toHaveLength(1);
	});

	test("records nothing for a product this app does not sell", async () => {
		expect(
			await Subscription.sync(db, "owner-1", entitlementState({ productSlug: "ebook" })),
		).toEqual({ applied: false, changed: false, entitled: false });

		expect(await Subscription.listAll(db)).toHaveLength(0);
	});
});

describe("Subscription.stateFor", () => {
	test("is unknown when the projection has never heard of the owner", async () => {
		expect(await Subscription.stateFor(db, "owner-1")).toBe("unknown");
		expect(await Subscription.isActive(db, "owner-1")).toBe(false);
	});

	test("is active when a recorded subscription is in an entitling status", async () => {
		await Subscription.sync(db, "owner-1", entitlementState({ status: "trialing" }));

		expect(await Subscription.stateFor(db, "owner-1")).toBe("active");
		expect(await Subscription.isActive(db, "owner-1")).toBe(true);
	});

	test("is inactive — not unknown — once a lapsed subscription is on record", async () => {
		await Subscription.sync(db, "owner-1", entitlementState({ status: "canceled" }));

		expect(await Subscription.stateFor(db, "owner-1")).toBe("inactive");
		expect(await Subscription.isActive(db, "owner-1")).toBe(false);
	});

	test("ignores another owner's subscription", async () => {
		await Subscription.sync(db, "owner-2", entitlementState());

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

		expect(await Subscription.stateFor(db, "owner-1")).toBe("unknown");
		expect(await Subscription.listAll(db)).toHaveLength(0);

		let claimed = await claimDue(db, monitors, ["id"], Date.now());

		expect(claimed.map((row) => row.id)).toEqual([monitor.id]);
	});
});
