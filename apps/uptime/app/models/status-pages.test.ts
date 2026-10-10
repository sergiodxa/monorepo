/**
 * Tests the status pages model against a migrated in-memory database: team-scoped reads, slug
 * uniqueness (global, with self-exclusion for edits), public-slug lookup, the full
 * delete cascade over its five attachment tables, the replace-the-full-set semantics of
 * `setMonitors`/`setDnsMonitors`/`setTcpMonitors`/`setFlowMonitors`/`setCronJobs`, and the
 * projection that keeps a flow's spec source off the public read path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { InsertStatusPage } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
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

/** A valid status page input, with any field overridable per test. */
function statusPageInput(overrides: Partial<InsertStatusPage> = {}) {
	return {
		name: "Public Status",
		slug: `status-${crypto.randomUUID()}`,
		title: "Acme Status",
		...overrides,
	};
}

/** A fresh database with the models bound to it. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db) };
}

/** Creates a status page for `teamId`, failing the test when the write is refused. */
async function createPage(
	models: ReturnType<typeof bindModels>,
	teamId: string,
	input: ReturnType<typeof statusPageInput> = statusPageInput(),
) {
	return unwrap(await models.statusPages.create({ ...input, team_id: teamId }));
}

describe("statusPages.create", () => {
	test("creates a status page for a team", async () => {
		let { models } = setup();
		let teamId = crypto.randomUUID();

		let page = await createPage(models, teamId, statusPageInput({ slug: "acme" }));

		expect(page.team_id).toBe(teamId);
		expect(page.slug).toBe("acme");
		/**
		 * SQLite (and the production D1 adapter, identically) round-trips boolean
		 * columns as 0/1, so this asserts truthiness.
		 */
		expect(page.is_public).toBeTruthy();
	});
});

describe("statusPages.inTeam ordered newest first", () => {
	test("lists a team's status pages, most recently created first", async () => {
		let { db, models } = setup();
		let teamId = crypto.randomUUID();
		let first = await createPage(models, teamId, statusPageInput());
		/**
		 * Force a distinct `created_at` so the ordering assertion below is
		 * deterministic; two creates in the same millisecond would tie.
		 */
		await db.update(statusPages, first.id, { created_at: first.created_at - 1000 });
		let second = await createPage(models, teamId, statusPageInput());

		let rows = await models.statusPages.inTeam(teamId).orderBy("created_at", "desc").all();
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's status pages", async () => {
		let { models } = setup();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		await createPage(models, teamA, statusPageInput());

		expect(await models.statusPages.inTeam(teamB).orderBy("created_at", "desc").all()).toEqual([]);
	});
});

describe("statusPages.inTeam", () => {
	test("selects the team's status pages and none of another team's", async () => {
		let { models } = setup();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let mine = await createPage(models, teamA, statusPageInput());
		await createPage(models, teamB, statusPageInput());

		let rows = await models.statusPages.inTeam(teamA).all();
		expect(rows.map((row) => row.id)).toEqual([mine.id]);
	});
});

describe("statusPages.inTeam lookup", () => {
	test("finds a page scoped to its team", async () => {
		let { models } = setup();
		let teamId = crypto.randomUUID();
		let page = await createPage(models, teamId, statusPageInput());

		expect((await models.statusPages.inTeam(teamId).where({ id: page.id }).first())?.id).toBe(
			page.id,
		);
	});

	test("returns null when the page belongs to a different team", async () => {
		let { models } = setup();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let page = await createPage(models, teamA, statusPageInput());

		expect(await models.statusPages.inTeam(teamB).where({ id: page.id }).first()).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { models } = setup();
		expect(
			await models.statusPages
				.inTeam(crypto.randomUUID())
				.where({ id: crypto.randomUUID() })
				.first(),
		).toBeNull();
	});
});

describe("statusPages.findPublic", () => {
	test("finds a public page by slug", async () => {
		let { models } = setup();
		let page = await createPage(
			models,
			crypto.randomUUID(),
			statusPageInput({ slug: "public-page", is_public: true }),
		);

		expect((await models.statusPages.findPublic("public-page"))?.id).toBe(page.id);
	});

	test("returns null for a private page's slug", async () => {
		let { models } = setup();
		await createPage(
			models,
			crypto.randomUUID(),
			statusPageInput({ slug: "private-page", is_public: false }),
		);

		expect(await models.statusPages.findPublic("private-page")).toBeNull();
	});

	test("returns null for a slug that doesn't exist", async () => {
		let { models } = setup();
		expect(await models.statusPages.findPublic("nope")).toBeNull();
	});
});

describe("statusPages.isSlugTaken", () => {
	test("is false when no page uses the slug", async () => {
		let { models } = setup();
		expect(await models.statusPages.isSlugTaken("unused")).toBe(false);
	});

	test("is true when a different page already uses the slug", async () => {
		let { models } = setup();
		await createPage(models, crypto.randomUUID(), statusPageInput({ slug: "taken" }));

		expect(await models.statusPages.isSlugTaken("taken")).toBe(true);
	});

	test("is false when the only page using the slug is the one being excluded", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput({ slug: "mine" }));

		expect(await models.statusPages.isSlugTaken("mine", page.id)).toBe(false);
	});

	test("is true when a different page uses the slug, even with an excludeId set", async () => {
		let { models } = setup();
		await createPage(models, crypto.randomUUID(), statusPageInput({ slug: "taken" }));

		expect(await models.statusPages.isSlugTaken("taken", crypto.randomUUID())).toBe(true);
	});
});

describe("statusPages.update", () => {
	test("updates a page's editable fields", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());

		let updated = unwrap(await models.statusPages.update(page.id, { title: "Renamed" }));
		expect(updated.title).toBe("Renamed");
	});
});

describe("statusPages.delete", () => {
	test("deletes the page and every row attaching monitors to it", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let monitorId = crypto.randomUUID();
		let dnsMonitorId = crypto.randomUUID();
		let tcpMonitorId = crypto.randomUUID();
		let flowMonitorId = crypto.randomUUID();
		let cronJobId = crypto.randomUUID();

		await models.statusPages.setMonitors(page.id, [monitorId]);
		await models.statusPages.setDnsMonitors(page.id, [dnsMonitorId]);
		await models.statusPages.setTcpMonitors(page.id, [tcpMonitorId]);
		await models.statusPages.setFlowMonitors(page.id, [flowMonitorId]);
		await models.statusPages.setCronJobs(page.id, [cronJobId]);

		unwrap(await models.statusPages.delete(page.id));

		expect(await models.statusPages.inTeam(page.team_id).where({ id: page.id }).first()).toBeNull();
		expect(await models.statusPages.getAttachedIds(page.id)).toEqual({
			monitorIds: [],
			dnsMonitorIds: [],
			tcpMonitorIds: [],
			flowMonitorIds: [],
			cronJobIds: [],
		});
	});
});

describe("statusPages.setMonitors", () => {
	test("replaces the full set of attached monitors in the given order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [monitorA, monitorB] = [crypto.randomUUID(), crypto.randomUUID()];

		await models.statusPages.setMonitors(page.id, [monitorA, monitorB]);
		let attachments = await models.statusPages.listAttachments(page.id);
		expect(attachments.monitors.map((row) => row.monitor_id)).toEqual([monitorA, monitorB]);

		await models.statusPages.setMonitors(page.id, [monitorB]);
		attachments = await models.statusPages.listAttachments(page.id);
		expect(attachments.monitors.map((row) => row.monitor_id)).toEqual([monitorB]);
	});

	test("clears the set entirely when given an empty array", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		await models.statusPages.setMonitors(page.id, [crypto.randomUUID()]);

		await models.statusPages.setMonitors(page.id, []);

		expect((await models.statusPages.getAttachedIds(page.id)).monitorIds).toEqual([]);
	});
});

describe("statusPages.setDnsMonitors", () => {
	test("replaces the full set of attached DNS monitors in the given order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [dnsA, dnsB] = [crypto.randomUUID(), crypto.randomUUID()];

		await models.statusPages.setDnsMonitors(page.id, [dnsA, dnsB]);
		expect((await models.statusPages.getAttachedIds(page.id)).dnsMonitorIds).toEqual([dnsA, dnsB]);

		await models.statusPages.setDnsMonitors(page.id, []);
		expect((await models.statusPages.getAttachedIds(page.id)).dnsMonitorIds).toEqual([]);
	});
});

describe("statusPages.setTcpMonitors", () => {
	test("replaces the full set of attached TCP monitors in the given order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [tcpA, tcpB] = [crypto.randomUUID(), crypto.randomUUID()];

		await models.statusPages.setTcpMonitors(page.id, [tcpA, tcpB]);
		expect((await models.statusPages.getAttachedIds(page.id)).tcpMonitorIds).toEqual([tcpA, tcpB]);

		await models.statusPages.setTcpMonitors(page.id, []);
		expect((await models.statusPages.getAttachedIds(page.id)).tcpMonitorIds).toEqual([]);
	});
});

describe("statusPages.setFlowMonitors", () => {
	test("replaces the full set of attached flow monitors in the given order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [flowA, flowB] = [crypto.randomUUID(), crypto.randomUUID()];

		await models.statusPages.setFlowMonitors(page.id, [flowA, flowB]);
		expect((await models.statusPages.getAttachedIds(page.id)).flowMonitorIds).toEqual([
			flowA,
			flowB,
		]);

		await models.statusPages.setFlowMonitors(page.id, []);
		expect((await models.statusPages.getAttachedIds(page.id)).flowMonitorIds).toEqual([]);
	});

	test("orders the attachments as curated, so the public page renders them in that order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [flowA, flowB] = [crypto.randomUUID(), crypto.randomUUID()];

		await models.statusPages.setFlowMonitors(page.id, [flowB, flowA]);

		let attachments = await models.statusPages.listAttachments(page.id);
		expect(attachments.flowMonitors.map((row) => row.flow_monitor_id)).toEqual([flowB, flowA]);
		expect(attachments.flowMonitors.map((row) => row.order)).toEqual([0, 1]);
	});
});

describe("statusPages.listPublicFlowMonitors", () => {
	test("returns a team's flow monitors with the status the page renders", async () => {
		let { db, models } = setup();
		let teamId = crypto.randomUUID();
		let flow = await createFlowMonitor(db, teamId, { name: "Checkout", last_status: "down" });

		let rows = await models.statusPages.listPublicFlowMonitors(teamId);

		expect(rows).toEqual([{ id: flow.id, name: "Checkout", last_status: "down" }]);
	});

	/**
	 * The source holds the credentials the flow signs in with, so the guarantee has to be
	 * that the column is never selected — not that some later hop remembers to drop it.
	 */
	test("never returns the spec source, in any form", async () => {
		let { db, models } = setup();
		let teamId = crypto.randomUUID();
		await createFlowMonitor(db, teamId, { source: 'header "Authorization" "Bearer s3cr3t"' });

		let rows = await models.statusPages.listPublicFlowMonitors(teamId);

		expect(rows.map((row) => Object.keys(row))).toEqual([["id", "name", "last_status"]]);
		expect(JSON.stringify(rows)).not.toContain("s3cr3t");
	});

	test("never returns another team's flow monitors", async () => {
		let { db, models } = setup();
		let teamId = crypto.randomUUID();
		await createFlowMonitor(db, teamId);

		expect(await models.statusPages.listPublicFlowMonitors(crypto.randomUUID())).toEqual([]);
	});
});

describe("statusPages.setCronJobs", () => {
	test("replaces the full set of attached cron jobs in the given order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [cronA, cronB] = [crypto.randomUUID(), crypto.randomUUID()];

		await models.statusPages.setCronJobs(page.id, [cronA, cronB]);
		expect((await models.statusPages.getAttachedIds(page.id)).cronJobIds).toEqual([cronA, cronB]);

		await models.statusPages.setCronJobs(page.id, []);
		expect((await models.statusPages.getAttachedIds(page.id)).cronJobIds).toEqual([]);
	});
});

describe("statusPages.getAttachedIds", () => {
	test("returns every attached id, empty lists when nothing is attached", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());

		expect(await models.statusPages.getAttachedIds(page.id)).toEqual({
			monitorIds: [],
			dnsMonitorIds: [],
			tcpMonitorIds: [],
			flowMonitorIds: [],
			cronJobIds: [],
		});
	});
});

describe("statusPages.listAttachments", () => {
	test("returns each kind's rows ordered by their curated order", async () => {
		let { models } = setup();
		let page = await createPage(models, crypto.randomUUID(), statusPageInput());
		let [monitorA, monitorB] = [crypto.randomUUID(), crypto.randomUUID()];
		await models.statusPages.setMonitors(page.id, [monitorA, monitorB]);

		let attachments = await models.statusPages.listAttachments(page.id);
		expect(attachments.monitors.map((row) => row.monitor_id)).toEqual([monitorA, monitorB]);
		expect(attachments.dnsMonitors).toEqual([]);
		expect(attachments.tcpMonitors).toEqual([]);
		expect(attachments.flowMonitors).toEqual([]);
		expect(attachments.cronJobs).toEqual([]);
	});
});
