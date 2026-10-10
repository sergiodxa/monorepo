/**
 * Unit tests for the teams model: team/slug lookup, the teams a subject belongs to,
 * provisioning with its owner's admin membership and `uniqueSlug` collision handling, and —
 * the highest-value case — `delete`'s full cascade across every team-owned table, checked
 * against a second team that must come through it intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { IdToken } from "@sdxc/auth/id-token";
import { NotFound } from "@sdxc/data-model";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";
import type { AlertConfig, ApiKeyScope } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { generateTeamSlug } from "~/app/models/teams";
import {
	alertEvents,
	alerts,
	apiKeys,
	cronJobMonitors,
	cronJobPings,
	dnsMonitorResults,
	dnsMonitors,
	flowMonitors,
	invites,
	maintenanceWindows,
	memberships,
	monitorContentChecks,
	monitorDailyStats,
	monitorResults,
	monitors,
	statusPageMonitors,
	statusPages,
	tcpMonitorResults,
	tcpMonitors,
	teamDomains,
	teams,
} from "~/database/schema";

/** Models over a fresh database, enqueuing into a recorder so no write reaches a queue. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db, recordJobs().jobs) };
}

/** Creates a subject's personal team, failing the test when the write is refused. */
async function createPersonal(models: UptimeModels, idToken: IdToken = buildIdToken()) {
	return unwrap(await models.teams.createPersonal(idToken));
}

/** Creates an additional team, failing the test when the write is refused. */
async function createAdditional(models: UptimeModels, ownerId: string, name: string) {
	return unwrap(await models.teams.createAdditional(ownerId, name));
}

/** An HTTP monitor row for a team, seeded directly since its model lives elsewhere. */
async function seedMonitor(db: Database, teamId: string, authorId: string) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			author_id: authorId,
			name: "Homepage",
			url: "https://example.com",
		},
		{ touch: true, returnRow: true },
	);
}

/** A fully-populated `IdToken`, with any claim overridable per test. */
function buildIdToken(
	overrides: Partial<{
		subject: string;
		name: string;
		email: string;
		picture: string;
		username: string;
	}> = {},
) {
	return new IdToken({
		sub: overrides.subject ?? crypto.randomUUID(),
		name: overrides.name ?? "Jane Doe",
		email: overrides.email ?? "jane@example.com",
		picture: overrides.picture ?? "https://example.com/avatar.png",
		preferred_username: overrides.username ?? "janedoe",
	});
}

/**
 * Creates a team owned by `ownerSubjectId` with one row in every team-owned table
 * `teams.delete` must cascade, plus the histories and attachments hanging off
 * those rows, and returns them all so callers can assert on each side of a delete.
 */
async function seedFullTeam(db: Database, models: UptimeModels, ownerSubjectId: string) {
	let team = await createPersonal(models, buildIdToken({ subject: ownerSubjectId }));

	let monitor = await seedMonitor(db, team.id, ownerSubjectId);
	let monitorResult = await db.create(
		monitorResults,
		{
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: Date.now(),
			response_status: 200,
			response_time_ms: 42,
		},
		{ touch: true, returnRow: true },
	);
	let contentCheck = await db.create(
		monitorContentChecks,
		{ id: crypto.randomUUID(), monitor_id: monitor.id, type: "contains", value: "OK" },
		{ touch: true, returnRow: true },
	);
	let dailyStats = await db.create(
		monitorDailyStats,
		{
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			monitor_type: "http",
			date: "2026-03-01",
			total_checks: 10,
			successful_checks: 10,
			failed_checks: 0,
			avg_response_time_ms: 40,
			max_response_time_ms: 60,
			status: "up",
		},
		{ touch: true, returnRow: true },
	);

	let dnsMonitor = await db.create(
		dnsMonitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "DNS",
			domain: "example.com",
		},
		{ touch: true, returnRow: true },
	);
	let dnsResult = await db.create(
		dnsMonitorResults,
		{
			id: crypto.randomUUID(),
			dns_monitor_id: dnsMonitor.id,
			status: "ok",
			checked_at: Date.now(),
		},
		{ returnRow: true },
	);

	let tcpMonitor = await db.create(
		tcpMonitors,
		{ id: crypto.randomUUID(), team_id: team.id, name: "TCP", host: "db.example.com", port: 5432 },
		{ touch: true, returnRow: true },
	);
	let tcpResult = await db.create(
		tcpMonitorResults,
		{
			id: crypto.randomUUID(),
			tcp_monitor_id: tcpMonitor.id,
			status: "up",
			checked_at: Date.now(),
		},
		{ returnRow: true },
	);

	let cronJob = await db.create(
		cronJobMonitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Nightly job",
			cron_expression: "0 0 * * *",
		},
		{ touch: true, returnRow: true },
	);
	let cronPing = await db.create(
		cronJobPings,
		{ id: crypto.randomUUID(), cron_job_monitor_id: cronJob.id, was_on_time: true },
		{ touch: true, returnRow: true },
	);

	let alert = await db.create(
		alerts,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			monitor_id: monitor.id,
			name: "Downtime alert",
			/**
			 * The test adapter binds SQLite parameters directly, so a `c.json()` column's
			 * value must already be a string — stringify it and cast past the column's
			 * declared object type (`AlertConfig`).
			 */
			config: JSON.stringify({
				strategy: "webhook",
				config: { url: "https://hooks.example.com", secret: "s3cr3t" },
			}) as unknown as AlertConfig,
		},
		{ touch: true, returnRow: true },
	);
	let alertEvent = await db.create(
		alertEvents,
		{
			id: crypto.randomUUID(),
			sent_at: Date.now(),
			alert_id: alert.id,
			monitor_id: monitor.id,
			event_type: "down",
			status: "sent",
			snapshot: null,
		},
		{ touch: true, returnRow: true },
	);

	let maintenanceWindow = await db.create(
		maintenanceWindows,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Planned maintenance",
			starts_at: Date.now(),
			ends_at: Date.now() + 3_600_000,
		},
		{ touch: true, returnRow: true },
	);

	let statusPage = await db.create(
		statusPages,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Public status",
			slug: `status-${crypto.randomUUID()}`,
			title: "Status",
		},
		{ touch: true, returnRow: true },
	);
	await db.create(statusPageMonitors, { status_page_id: statusPage.id, monitor_id: monitor.id });

	let apiKey = await db.create(
		apiKeys,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "CI key",
			key_hash: "hash",
			key_prefix: "uptime_abc123456",
			/**
			 * Same rationale as `alerts.config` above: stringify for the SQLite binding,
			 * cast past the column's declared array type.
			 */
			scopes: JSON.stringify(["monitors:read"]) as unknown as ApiKeyScope[],
		},
		{ touch: true, returnRow: true },
	);

	let domain = unwrap(
		await models.teamDomains.create({ team_id: team.id, hostname: "example.com" }),
	);

	let invite = await db.create(
		invites,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			sender_id: ownerSubjectId,
			email: "invitee@example.com",
		},
		{ touch: true, returnRow: true },
	);

	return {
		team,
		monitor,
		monitorResult,
		contentCheck,
		dailyStats,
		dnsMonitor,
		dnsResult,
		tcpMonitor,
		tcpResult,
		cronJob,
		cronPing,
		alert,
		alertEvent,
		maintenanceWindow,
		statusPage,
		apiKey,
		domain,
		invite,
	};
}

type SeededTeam = Awaited<ReturnType<typeof seedFullTeam>>;

/** Asserts every row `seedFullTeam` created for `seed` is still present. */
async function expectSeedIntact(db: Database, seed: SeededTeam) {
	expect(await db.find(teams, seed.team.id)).not.toBeNull();
	expect(await db.find(monitors, seed.monitor.id)).not.toBeNull();
	expect(await db.find(monitorResults, seed.monitorResult.id)).not.toBeNull();
	expect(await db.find(monitorContentChecks, seed.contentCheck.id)).not.toBeNull();
	expect(
		(await db.findMany(monitorDailyStats, { where: { monitor_id: seed.monitor.id } })).map(
			(row) => row.id,
		),
	).toContain(seed.dailyStats.id);
	expect(await db.find(dnsMonitors, seed.dnsMonitor.id)).not.toBeNull();
	expect(await db.find(dnsMonitorResults, seed.dnsResult.id)).not.toBeNull();
	expect(await db.find(tcpMonitors, seed.tcpMonitor.id)).not.toBeNull();
	expect(await db.find(tcpMonitorResults, seed.tcpResult.id)).not.toBeNull();
	expect(await db.find(cronJobMonitors, seed.cronJob.id)).not.toBeNull();
	expect(await db.find(cronJobPings, seed.cronPing.id)).not.toBeNull();
	expect(await db.find(alerts, seed.alert.id)).not.toBeNull();
	expect(await db.find(alertEvents, seed.alertEvent.id)).not.toBeNull();
	expect(await db.find(maintenanceWindows, seed.maintenanceWindow.id)).not.toBeNull();
	expect(await db.find(statusPages, seed.statusPage.id)).not.toBeNull();
	expect(
		await db.findMany(statusPageMonitors, { where: { status_page_id: seed.statusPage.id } }),
	).toHaveLength(1);
	expect(await db.find(apiKeys, seed.apiKey.id)).not.toBeNull();
	expect(await db.find(teamDomains, seed.domain.id)).not.toBeNull();
	expect(await db.find(invites, seed.invite.id)).not.toBeNull();
	expect(await db.findMany(memberships, { where: { team_id: seed.team.id } })).not.toHaveLength(0);
}

/** Asserts every row `seedFullTeam` created for `seed` has been deleted. */
async function expectSeedGone(db: Database, seed: SeededTeam) {
	expect(await db.find(teams, seed.team.id)).toBeNull();
	expect(await db.find(monitors, seed.monitor.id)).toBeNull();
	expect(await db.find(monitorResults, seed.monitorResult.id)).toBeNull();
	expect(await db.find(monitorContentChecks, seed.contentCheck.id)).toBeNull();
	expect(await db.findMany(monitorDailyStats, { where: { monitor_id: seed.monitor.id } })).toEqual(
		[],
	);
	expect(await db.find(dnsMonitors, seed.dnsMonitor.id)).toBeNull();
	expect(await db.find(dnsMonitorResults, seed.dnsResult.id)).toBeNull();
	expect(await db.find(tcpMonitors, seed.tcpMonitor.id)).toBeNull();
	expect(await db.find(tcpMonitorResults, seed.tcpResult.id)).toBeNull();
	expect(await db.find(cronJobMonitors, seed.cronJob.id)).toBeNull();
	expect(await db.find(cronJobPings, seed.cronPing.id)).toBeNull();
	expect(await db.find(alerts, seed.alert.id)).toBeNull();
	expect(await db.find(alertEvents, seed.alertEvent.id)).toBeNull();
	expect(await db.find(maintenanceWindows, seed.maintenanceWindow.id)).toBeNull();
	expect(await db.find(statusPages, seed.statusPage.id)).toBeNull();
	expect(
		await db.findMany(statusPageMonitors, { where: { status_page_id: seed.statusPage.id } }),
	).toEqual([]);
	expect(await db.find(apiKeys, seed.apiKey.id)).toBeNull();
	expect(await db.find(teamDomains, seed.domain.id)).toBeNull();
	expect(await db.find(invites, seed.invite.id)).toBeNull();
	expect(await db.findMany(memberships, { where: { team_id: seed.team.id } })).toEqual([]);
}

describe("teams.findByIdOrSlug", () => {
	test("finds a team by its UUID id", async () => {
		let { models } = setup();
		let team = await createPersonal(models);

		expect((await models.teams.findByIdOrSlug(team.id))?.id).toBe(team.id);
	});

	test("finds a team by its slug", async () => {
		let { models } = setup();
		let team = await createPersonal(models, buildIdToken({ username: "acme" }));

		expect((await models.teams.findByIdOrSlug(team.slug))?.id).toBe(team.id);
	});

	test("returns null for an id that doesn't exist", async () => {
		let { models } = setup();
		expect(await models.teams.findByIdOrSlug(crypto.randomUUID())).toBeNull();
	});

	test("returns null for a slug that doesn't exist", async () => {
		let { models } = setup();
		expect(await models.teams.findByIdOrSlug("no-such-slug")).toBeNull();
	});
});

describe("teams.findByIds", () => {
	test("keys each listed team by id and leaves out an id that names none", async () => {
		let { models } = setup();
		let team = await createPersonal(models);
		let missing = crypto.randomUUID();

		let found = await models.teams.findByIds([team.id, team.id, missing]);

		expect([...found.keys()]).toEqual([team.id]);
		expect(found.get(team.id)?.slug).toBe(team.slug);
	});

	test("returns an empty map for an empty list", async () => {
		let { models } = setup();
		expect((await models.teams.findByIds([])).size).toBe(0);
	});
});

describe("teams.ownerIdsByTeamIds", () => {
	test("maps each team to its owner's subject id", async () => {
		let { models } = setup();
		let ownerId = crypto.randomUUID();
		let team = await createPersonal(models, buildIdToken({ subject: ownerId }));

		let owners = await models.teams.ownerIdsByTeamIds([team.id, crypto.randomUUID()]);

		expect([...owners]).toEqual([[team.id, ownerId]]);
	});
});

describe("teams.listForSubject", () => {
	test("lists every team a subject belongs to", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let team = await createPersonal(models, buildIdToken({ subject: subjectId }));

		let rows = await models.teams.listForSubject(subjectId);
		expect(rows.map((row) => row.id)).toEqual([team.id]);
	});

	test("returns an empty array for a subject with no memberships", async () => {
		let { models } = setup();
		expect(await models.teams.listForSubject(crypto.randomUUID())).toEqual([]);
	});
});

describe("teams.createPersonal", () => {
	test("creates a personal team named after the subject and makes them its owning admin", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let idToken = buildIdToken({
			subject: subjectId,
			name: "Jane Doe",
			username: "JaneDoe",
			picture: "https://cdn.example.com/jane.png",
		});

		let team = await createPersonal(models, idToken);

		expect(team.owner_id).toBe(subjectId);
		expect(team.name).toBe("Jane Doe's Team");
		expect(team.slug).toBe("janedoe-team");
		expect(team.logo).toBe("https://cdn.example.com/jane.png");
		expect((await models.memberships.findFor(team.id, subjectId))?.role).toBe("admin");
	});

	test("falls back to a null logo when the token has no picture", async () => {
		let { models } = setup();

		let team = await createPersonal(models, buildIdToken({ picture: "" }));
		expect(team.logo).toBeNull();
	});
});

describe("teams.create", () => {
	test("makes the owner of any created team its admin member", async () => {
		let { models } = setup();
		let ownerId = crypto.randomUUID();

		let team = unwrap(
			await models.teams.create({ owner_id: ownerId, name: "Ops", slug: "ops", logo: null }),
		);

		let members = await models.memberships.inTeam(team.id).all();
		expect(members.map((row) => [row.subject_id, row.role])).toEqual([[ownerId, "admin"]]);
	});
});

describe("teams.createAdditional", () => {
	test("creates a team owned by the given subject with a slug derived from its name", async () => {
		let { models } = setup();
		let ownerId = crypto.randomUUID();

		let team = await createAdditional(models, ownerId, "Ops Team");

		expect(team.owner_id).toBe(ownerId);
		expect(team.name).toBe("Ops Team");
		expect(team.slug).toBe("ops-team");
		expect((await models.memberships.findFor(team.id, ownerId))?.role).toBe("admin");
	});

	test("appends a suffix when the derived slug collides with an existing team", async () => {
		let { models } = setup();
		let first = await createAdditional(models, crypto.randomUUID(), "Ops Team");
		let second = await createAdditional(models, crypto.randomUUID(), "Ops Team");

		expect(second.slug).not.toBe(first.slug);
		expect(second.slug.startsWith("ops-team-")).toBe(true);
	});
});

describe("teams.uniqueSlug", () => {
	test("returns the candidate slug unchanged when it isn't taken", async () => {
		let { models } = setup();
		expect(await models.teams.uniqueSlug("fresh-slug")).toBe("fresh-slug");
	});

	test("appends a suffix until the slug no longer collides", async () => {
		let { models } = setup();
		await createAdditional(models, crypto.randomUUID(), "Taken");

		let slug = await models.teams.uniqueSlug("taken");
		expect(slug).not.toBe("taken");
		expect(slug).toMatch(/^taken-[0-9a-z]{6}$/);
		expect(await models.teams.findByIdOrSlug(slug)).toBeNull();
	});
});

describe("teams.listWithRoleForSubject", () => {
	test("lists every team with the subject's role and owner status", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let ownedTeam = await createPersonal(models, buildIdToken({ subject: subjectId }));

		let memberTeam = await createAdditional(models, crypto.randomUUID(), "Other Co");
		unwrap(
			await models.memberships.create({
				subject_id: subjectId,
				team_id: memberTeam.id,
				role: "member",
			}),
		);

		let rows = await models.teams.listWithRoleForSubject(subjectId);
		let byTeamId = new Map(rows.map((row) => [row.team.id, row]));

		expect(byTeamId.get(ownedTeam.id)).toMatchObject({ role: "admin", isOwner: true });
		expect(byTeamId.get(memberTeam.id)).toMatchObject({ role: "member", isOwner: false });
	});

	test("returns an empty array for a subject with no memberships", async () => {
		let { models } = setup();
		expect(await models.teams.listWithRoleForSubject(crypto.randomUUID())).toEqual([]);
	});
});

describe("teams.update", () => {
	test("updates a team's editable fields", async () => {
		let { models } = setup();
		let team = await createPersonal(models);

		let updated = unwrap(await models.teams.update(team.id, { name: "Renamed" }));
		expect(updated.name).toBe("Renamed");
	});
});

describe("teams.delete", () => {
	test("cascades to every row the team owns, without touching another team's data", async () => {
		let { db, models } = setup();
		let toDelete = await seedFullTeam(db, models, crypto.randomUUID());
		let untouched = await seedFullTeam(db, models, crypto.randomUUID());

		await expectSeedIntact(db, toDelete);
		await expectSeedIntact(db, untouched);

		unwrap(await models.teams.delete(toDelete.team.id));

		await expectSeedGone(db, toDelete);
		await expectSeedIntact(db, untouched);
	});

	test("succeeds for a team with no owned rows besides its own membership", async () => {
		let { db, models } = setup();
		let team = await createPersonal(models);

		unwrap(await models.teams.delete(team.id));

		expect(await db.find(teams, team.id)).toBeNull();
	});

	test("answers NotFound for a team that does not exist", async () => {
		let { models } = setup();

		let deleted = await models.teams.delete(crypto.randomUUID());

		expect(isFailure(deleted) && deleted.error).toBeInstanceOf(NotFound);
	});
});

describe("teams.countMonitorsByTeam", () => {
	/** One flow monitor, enough for the count to see the team. */
	async function seedFlowMonitor(db: Database, teamId: string) {
		return await db.create(
			flowMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "Sign in and load the dashboard",
				source:
					'test "a member can sign in" {\n\twhen {\n\t\tlet session = http.get "https://app.example.com/health"\n\t}\n}',
				interval_seconds: 3_600,
			},
			{ touch: true, returnRow: true },
		);
	}

	test("counts a team whose only monitor is a flow monitor", async () => {
		let { db, models } = setup();
		let team = await createPersonal(models);
		await seedFlowMonitor(db, team.id);

		let counts = await models.teams.countMonitorsByTeam();

		expect(counts.get(team.id)).toBe(1);
	});

	test("adds flow monitors to a team's other types rather than replacing them", async () => {
		let { db, models } = setup();
		let subjectId = crypto.randomUUID();
		let team = await createPersonal(models, buildIdToken({ subject: subjectId }));

		await seedMonitor(db, team.id, subjectId);
		await seedFlowMonitor(db, team.id);
		await seedFlowMonitor(db, team.id);

		let counts = await models.teams.countMonitorsByTeam();

		expect(counts.get(team.id)).toBe(3);
	});

	test("leaves a team with no monitors of any type out of the map", async () => {
		let { db, models } = setup();
		let withFlow = await createPersonal(models);
		let without = await createPersonal(models, buildIdToken({ username: "other" }));
		await seedFlowMonitor(db, withFlow.id);

		let counts = await models.teams.countMonitorsByTeam();

		expect(counts.get(withFlow.id)).toBe(1);
		expect(counts.has(without.id)).toBe(false);
	});
});

describe("generateTeamSlug", () => {
	test("lowercases and hyphenates a plain name", () => {
		expect(generateTeamSlug("Acme Corp")).toBe("acme-corp");
	});

	test("strips characters outside a-z, 0-9, spaces, and hyphens", () => {
		expect(generateTeamSlug("Acme! Corp. & Co?")).toBe("acme-corp-co");
	});

	test("collapses repeated hyphens introduced by stripped characters", () => {
		expect(generateTeamSlug("Acme -- Corp")).toBe("acme-corp");
	});

	test("trims leading/trailing whitespace before hyphenating", () => {
		expect(generateTeamSlug("  Acme Corp  ")).toBe("acme-corp");
	});

	test("truncates to 50 characters", () => {
		let name = "A".repeat(80);
		expect(generateTeamSlug(name)).toHaveLength(50);
	});
});
