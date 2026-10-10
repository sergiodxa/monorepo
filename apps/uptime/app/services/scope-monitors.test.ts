/**
 * Tests the scope lookups the alert and maintenance-window forms and the API share: the
 * per-type choices a team is offered, and whether a stored scope still names a monitor the
 * team owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { isResolvableScope, listScopeMonitors } from "~/app/services/scope-monitors";
import { monitors } from "~/database/schema";

/** A database holding two HTTP monitors and a DNS monitor for team-1, and one for team-2. */
async function setup() {
	let { db } = createTestDatabase();
	let models = bindModels(db, recordJobs().jobs);

	let older = unwrap(
		await models.monitors.create({
			team_id: "team-1",
			author_id: "user-1",
			name: "Older",
			url: "https://older.example.com",
		}),
	);
	let newer = unwrap(
		await models.monitors.create({
			team_id: "team-1",
			author_id: "user-1",
			name: "Newer",
			url: "https://newer.example.com",
		}),
	);
	await db.update(monitors, older.id, { created_at: Date.now() - 60_000 });

	let domain = unwrap(
		await models.dnsMonitors.create({
			team_id: "team-1",
			name: "example.com",
			domain: "example.com",
		}),
	);
	let foreign = unwrap(
		await models.monitors.create({
			team_id: "team-2",
			author_id: "user-2",
			name: "Foreign",
			url: "https://foreign.example.com",
		}),
	);

	return { models, older, newer, domain, foreign };
}

describe("listScopeMonitors", () => {
	test("groups the team's monitors by type, newest first, leaving out empty types", async () => {
		let { models, older, newer, domain } = await setup();

		expect(await listScopeMonitors(models, "team-1")).toEqual([
			{
				monitorType: "http",
				monitors: [
					expect.objectContaining({ id: newer.id, name: "Newer" }),
					expect.objectContaining({ id: older.id, name: "Older" }),
				],
			},
			{ monitorType: "dns", monitors: [expect.objectContaining({ id: domain.id })] },
		]);
	});

	test("answers no groups for a team with no monitors", async () => {
		let { models } = await setup();

		expect(await listScopeMonitors(models, "team-3")).toEqual([]);
	});
});

describe("isResolvableScope", () => {
	test("stores a team-wide or type-wide scope without a lookup", async () => {
		let { models } = await setup();

		expect(await isResolvableScope(models, "team-3", { monitorType: null, monitorId: null })).toBe(
			true,
		);
		expect(await isResolvableScope(models, "team-3", { monitorType: "tcp", monitorId: null })).toBe(
			true,
		);
	});

	test("resolves a monitor the team owns, under its own type", async () => {
		let { models, newer, domain } = await setup();

		expect(
			await isResolvableScope(models, "team-1", { monitorType: "http", monitorId: newer.id }),
		).toBe(true);
		expect(
			await isResolvableScope(models, "team-1", { monitorType: "dns", monitorId: domain.id }),
		).toBe(true);
	});

	test("refuses another team's monitor, or a monitor named under the wrong type", async () => {
		let { models, newer, foreign } = await setup();

		expect(
			await isResolvableScope(models, "team-1", { monitorType: "http", monitorId: foreign.id }),
		).toBe(false);
		expect(
			await isResolvableScope(models, "team-1", { monitorType: "dns", monitorId: newer.id }),
		).toBe(false);
	});
});
