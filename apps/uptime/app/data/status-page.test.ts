/**
 * Unit tests for the `StatusPage` data-access model: CRUD scoped to a team, slug
 * uniqueness (global, with self-exclusion for edits), public-slug lookup, the full
 * delete cascade over its five attachment tables, the replace-the-full-set semantics of
 * `setMonitors`/`setDnsMonitors`/`setTcpMonitors`/`setFlowMonitors`/`setCronJobs`, and the
 * projection that keeps a flow's spec source off the public read path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { InsertStatusPage } from "~/database/schema";

import StatusPage from "~/app/data/status-page";
import { createTestDatabase } from "~/app/lib/test/db";
import { flowMonitors, statusPages } from "~/database/schema";

/** Seeds a flow monitor whose source is the thing a public page must never publish. */
async function createFlowMonitor(
	db: ReturnType<typeof createTestDatabase>["db"],
	teamId: string,
	overrides: { name?: string; source?: string; last_status?: "up" | "down" | "error" | null } = {},
) {
	return await db.create(
		flowMonitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: overrides.name ?? "Sign in and read back",
			source: overrides.source ?? 'post "/session" { body: { password: "hunter2" } }',
			interval_seconds: 3600,
			next_due_at: null,
			is_enabled: true,
			last_checked_at: Date.now(),
			last_status: overrides.last_status ?? "up",
		},
		{ touch: true, returnRow: true },
	);
}

/** A valid `StatusPage.create` input, with any field overridable per test. */
function statusPageInput(overrides: Partial<InsertStatusPage> = {}): InsertStatusPage {
	return {
		name: "Public Status",
		slug: `status-${crypto.randomUUID()}`,
		title: "Acme Status",
		...overrides,
	};
}

describe("StatusPage.create", () => {
	test("creates a status page for a team", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();

		let page = await StatusPage.create(db, teamId, statusPageInput({ slug: "acme" }));

		expect(page.team_id).toBe(teamId);
		expect(page.slug).toBe("acme");
		/**
		 * SQLite (and the production D1 adapter, identically) round-trips boolean
		 * columns as 0/1, so this asserts truthiness.
		 */
		expect(page.is_public).toBeTruthy();
	});
});

describe("StatusPage.listByTeam", () => {
	test("lists a team's status pages, most recently created first", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let first = await StatusPage.create(db, teamId, statusPageInput());
		/**
		 * Force a distinct `created_at` so the ordering assertion below is
		 * deterministic; two creates in the same millisecond would tie.
		 */
		await db.update(statusPages, first.id, { created_at: first.created_at - 1000 });
		let second = await StatusPage.create(db, teamId, statusPageInput());

		let rows = await StatusPage.listByTeam(db, teamId);
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's status pages", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		await StatusPage.create(db, teamA, statusPageInput());

		expect(await StatusPage.listByTeam(db, teamB)).toEqual([]);
	});
});

describe("StatusPage.findByIdForTeam", () => {
	test("finds a page scoped to its team", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let page = await StatusPage.create(db, teamId, statusPageInput());

		expect((await StatusPage.findByIdForTeam(db, teamId, page.id))?.id).toBe(page.id);
	});

	test("returns null when the page belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let page = await StatusPage.create(db, teamA, statusPageInput());

		expect(await StatusPage.findByIdForTeam(db, teamB, page.id)).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(
			await StatusPage.findByIdForTeam(db, crypto.randomUUID(), crypto.randomUUID()),
		).toBeNull();
	});
});

describe("StatusPage.findBySlugPublic", () => {
	test("finds a public page by slug", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(
			db,
			crypto.randomUUID(),
			statusPageInput({ slug: "public-page", is_public: true }),
		);

		expect((await StatusPage.findBySlugPublic(db, "public-page"))?.id).toBe(page.id);
	});

	test("returns null for a private page's slug", async () => {
		let { db } = createTestDatabase();
		await StatusPage.create(
			db,
			crypto.randomUUID(),
			statusPageInput({ slug: "private-page", is_public: false }),
		);

		expect(await StatusPage.findBySlugPublic(db, "private-page")).toBeNull();
	});

	test("returns null for a slug that doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await StatusPage.findBySlugPublic(db, "nope")).toBeNull();
	});
});

describe("StatusPage.isSlugTaken", () => {
	test("is false when no page uses the slug", async () => {
		let { db } = createTestDatabase();
		expect(await StatusPage.isSlugTaken(db, "unused")).toBe(false);
	});

	test("is true when a different page already uses the slug", async () => {
		let { db } = createTestDatabase();
		await StatusPage.create(db, crypto.randomUUID(), statusPageInput({ slug: "taken" }));

		expect(await StatusPage.isSlugTaken(db, "taken")).toBe(true);
	});

	test("is false when the only page using the slug is the one being excluded", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput({ slug: "mine" }));

		expect(await StatusPage.isSlugTaken(db, "mine", page.id)).toBe(false);
	});

	test("is true when a different page uses the slug, even with an excludeId set", async () => {
		let { db } = createTestDatabase();
		await StatusPage.create(db, crypto.randomUUID(), statusPageInput({ slug: "taken" }));

		expect(await StatusPage.isSlugTaken(db, "taken", crypto.randomUUID())).toBe(true);
	});
});

describe("StatusPage.updateById", () => {
	test("updates a page's editable fields", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());

		let updated = await StatusPage.updateById(db, page.id, { title: "Renamed" });
		expect(updated.title).toBe("Renamed");
	});
});

describe("StatusPage.deleteById", () => {
	test("deletes the page and every row attaching monitors to it", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let monitorId = crypto.randomUUID();
		let dnsMonitorId = crypto.randomUUID();
		let tcpMonitorId = crypto.randomUUID();
		let flowMonitorId = crypto.randomUUID();
		let cronJobId = crypto.randomUUID();

		await StatusPage.setMonitors(db, page.id, [monitorId]);
		await StatusPage.setDnsMonitors(db, page.id, [dnsMonitorId]);
		await StatusPage.setTcpMonitors(db, page.id, [tcpMonitorId]);
		await StatusPage.setFlowMonitors(db, page.id, [flowMonitorId]);
		await StatusPage.setCronJobs(db, page.id, [cronJobId]);

		await StatusPage.deleteById(db, page.id);

		expect(await StatusPage.findByIdForTeam(db, page.team_id, page.id)).toBeNull();
		expect(await StatusPage.getAttachedIds(db, page.id)).toEqual({
			monitorIds: [],
			dnsMonitorIds: [],
			tcpMonitorIds: [],
			flowMonitorIds: [],
			cronJobIds: [],
		});
	});
});

describe("StatusPage.setMonitors", () => {
	test("replaces the full set of attached monitors in the given order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [monitorA, monitorB] = [crypto.randomUUID(), crypto.randomUUID()];

		await StatusPage.setMonitors(db, page.id, [monitorA, monitorB]);
		let attachments = await StatusPage.listAttachments(db, page.id);
		expect(attachments.monitors.map((row) => row.monitor_id)).toEqual([monitorA, monitorB]);

		await StatusPage.setMonitors(db, page.id, [monitorB]);
		attachments = await StatusPage.listAttachments(db, page.id);
		expect(attachments.monitors.map((row) => row.monitor_id)).toEqual([monitorB]);
	});

	test("clears the set entirely when given an empty array", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		await StatusPage.setMonitors(db, page.id, [crypto.randomUUID()]);

		await StatusPage.setMonitors(db, page.id, []);

		expect((await StatusPage.getAttachedIds(db, page.id)).monitorIds).toEqual([]);
	});
});

describe("StatusPage.setDnsMonitors", () => {
	test("replaces the full set of attached DNS monitors in the given order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [dnsA, dnsB] = [crypto.randomUUID(), crypto.randomUUID()];

		await StatusPage.setDnsMonitors(db, page.id, [dnsA, dnsB]);
		expect((await StatusPage.getAttachedIds(db, page.id)).dnsMonitorIds).toEqual([dnsA, dnsB]);

		await StatusPage.setDnsMonitors(db, page.id, []);
		expect((await StatusPage.getAttachedIds(db, page.id)).dnsMonitorIds).toEqual([]);
	});
});

describe("StatusPage.setTcpMonitors", () => {
	test("replaces the full set of attached TCP monitors in the given order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [tcpA, tcpB] = [crypto.randomUUID(), crypto.randomUUID()];

		await StatusPage.setTcpMonitors(db, page.id, [tcpA, tcpB]);
		expect((await StatusPage.getAttachedIds(db, page.id)).tcpMonitorIds).toEqual([tcpA, tcpB]);

		await StatusPage.setTcpMonitors(db, page.id, []);
		expect((await StatusPage.getAttachedIds(db, page.id)).tcpMonitorIds).toEqual([]);
	});
});

describe("StatusPage.setFlowMonitors", () => {
	test("replaces the full set of attached flow monitors in the given order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [flowA, flowB] = [crypto.randomUUID(), crypto.randomUUID()];

		await StatusPage.setFlowMonitors(db, page.id, [flowA, flowB]);
		expect((await StatusPage.getAttachedIds(db, page.id)).flowMonitorIds).toEqual([flowA, flowB]);

		await StatusPage.setFlowMonitors(db, page.id, []);
		expect((await StatusPage.getAttachedIds(db, page.id)).flowMonitorIds).toEqual([]);
	});

	test("orders the attachments as curated, so the public page renders them in that order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [flowA, flowB] = [crypto.randomUUID(), crypto.randomUUID()];

		await StatusPage.setFlowMonitors(db, page.id, [flowB, flowA]);

		let attachments = await StatusPage.listAttachments(db, page.id);
		expect(attachments.flowMonitors.map((row) => row.flow_monitor_id)).toEqual([flowB, flowA]);
		expect(attachments.flowMonitors.map((row) => row.order)).toEqual([0, 1]);
	});
});

describe("StatusPage.listPublicFlowMonitors", () => {
	test("returns a team's flow monitors with the status the page renders", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let flow = await createFlowMonitor(db, teamId, { name: "Checkout", last_status: "down" });

		let rows = await StatusPage.listPublicFlowMonitors(db, teamId);

		expect(rows).toEqual([{ id: flow.id, name: "Checkout", last_status: "down" }]);
	});

	/**
	 * The source holds the credentials the flow signs in with, so the guarantee has to be
	 * that the column is never selected — not that some later hop remembers to drop it.
	 */
	test("never returns the spec source, in any form", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		await createFlowMonitor(db, teamId, { source: 'header "Authorization" "Bearer s3cr3t"' });

		let rows = await StatusPage.listPublicFlowMonitors(db, teamId);

		expect(rows.map((row) => Object.keys(row))).toEqual([["id", "name", "last_status"]]);
		expect(JSON.stringify(rows)).not.toContain("s3cr3t");
	});

	test("never returns another team's flow monitors", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		await createFlowMonitor(db, teamId);

		expect(await StatusPage.listPublicFlowMonitors(db, crypto.randomUUID())).toEqual([]);
	});
});

describe("StatusPage.setCronJobs", () => {
	test("replaces the full set of attached cron jobs in the given order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [cronA, cronB] = [crypto.randomUUID(), crypto.randomUUID()];

		await StatusPage.setCronJobs(db, page.id, [cronA, cronB]);
		expect((await StatusPage.getAttachedIds(db, page.id)).cronJobIds).toEqual([cronA, cronB]);

		await StatusPage.setCronJobs(db, page.id, []);
		expect((await StatusPage.getAttachedIds(db, page.id)).cronJobIds).toEqual([]);
	});
});

describe("StatusPage.getAttachedIds", () => {
	test("returns every attached id, empty lists when nothing is attached", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());

		expect(await StatusPage.getAttachedIds(db, page.id)).toEqual({
			monitorIds: [],
			dnsMonitorIds: [],
			tcpMonitorIds: [],
			flowMonitorIds: [],
			cronJobIds: [],
		});
	});
});

describe("StatusPage.listAttachments", () => {
	test("returns each kind's rows ordered by their curated order", async () => {
		let { db } = createTestDatabase();
		let page = await StatusPage.create(db, crypto.randomUUID(), statusPageInput());
		let [monitorA, monitorB] = [crypto.randomUUID(), crypto.randomUUID()];
		await StatusPage.setMonitors(db, page.id, [monitorA, monitorB]);

		let attachments = await StatusPage.listAttachments(db, page.id);
		expect(attachments.monitors.map((row) => row.monitor_id)).toEqual([monitorA, monitorB]);
		expect(attachments.dnsMonitors).toEqual([]);
		expect(attachments.tcpMonitors).toEqual([]);
		expect(attachments.flowMonitors).toEqual([]);
		expect(attachments.cronJobs).toEqual([]);
	});
});
