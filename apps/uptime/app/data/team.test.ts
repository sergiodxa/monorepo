/**
 * Unit tests for the `Team` data-access model: team/slug lookup, membership
 * resolution and listing (including `isOwner` derivation), domain auto-join,
 * team provisioning (`createTeam`/`createAdditional`) with `uniqueSlug` collision
 * handling, role/membership management, and — the highest-value case —
 * `deleteById`'s full cascade across every team-owned table, verified against a
 * second, untouched team to prove the cascade never leaks across teams.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Database } from "remix/data-table";

import type { AlertConfig, ApiKeyScope } from "~/database/schema";

import IdToken from "~/app/auth/value-objects/id-token";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import Team, { generateTeamSlug } from "~/app/data/team";
import TeamDomain from "~/app/data/team-domain";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	alertEvents,
	alerts,
	apiKeys,
	cronJobMonitors,
	cronJobPings,
	dnsMonitorResults,
	dnsMonitors,
	invites,
	maintenanceWindows,
	memberships,
	monitorContentChecks,
	monitorDailyStats,
	monitorResults,
	statusPageMonitors,
	statusPages,
	tcpMonitorResults,
	tcpMonitors,
	teamDomains,
	teams,
} from "~/database/schema";

/**
 * `~/app/data/monitor` imports `env` from `cloudflare:workers`, which doesn't resolve
 * outside the Workers runtime — stub it so the module loads, and import `Monitor`
 * dynamically afterwards so the stub is registered before that import evaluates.
 * Nothing here reaches the queue; the seed only creates monitors and reads them back.
 */
mock.module("cloudflare:workers", () => ({ env: { QUEUE: { send: async () => {} } } }));

let { default: Monitor } = await import("~/app/data/monitor");

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
 * Creates a team owned by `ownerSubjectId` with one row in every team-owned
 * table `Team.deleteById` must cascade, plus the histories/attachments hanging
 * off those rows. Returns every created row so callers can assert on presence
 * (before delete) or absence (after delete).
 */
async function seedFullTeam(db: Database, ownerSubjectId: string) {
	let team = await Team.createTeam(db, buildIdToken({ subject: ownerSubjectId }));

	let monitor = await Monitor.create(db, team.id, ownerSubjectId, {
		name: "Homepage",
		url: "https://example.com",
	});
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
	let dailyStats = await MonitorDailyStats.upsertDay(db, {
		monitor_id: monitor.id,
		monitor_type: "http",
		date: "2026-03-01",
		total_checks: 10,
		successful_checks: 10,
		failed_checks: 0,
		avg_response_time_ms: 40,
		max_response_time_ms: 60,
		status: "up",
	});

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

	let tcpMonitor = await TcpMonitor.create(db, team.id, {
		name: "TCP",
		host: "db.example.com",
		port: 5432,
	});
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
			 * declared object type (`AlertConfig`) rather than fighting the type system.
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

	let statusPage = await StatusPage.create(db, team.id, {
		name: "Public status",
		slug: `status-${crypto.randomUUID()}`,
		title: "Status",
	});
	await StatusPage.setMonitors(db, statusPage.id, [monitor.id]);

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

	let domain = await TeamDomain.create(db, team.id, "example.com");

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
	expect(await Monitor.findByIdForTeam(db, seed.team.id, seed.monitor.id)).not.toBeNull();
	expect(await db.find(monitorResults, seed.monitorResult.id)).not.toBeNull();
	expect(await db.find(monitorContentChecks, seed.contentCheck.id)).not.toBeNull();
	expect(
		(await db.findMany(monitorDailyStats, { where: { monitor_id: seed.monitor.id } })).map(
			(row) => row.id,
		),
	).toContain(seed.dailyStats.id);
	expect(await db.find(dnsMonitors, seed.dnsMonitor.id)).not.toBeNull();
	expect(await db.find(dnsMonitorResults, seed.dnsResult.id)).not.toBeNull();
	expect(await TcpMonitor.findByIdForTeam(db, seed.team.id, seed.tcpMonitor.id)).not.toBeNull();
	expect(await db.find(tcpMonitorResults, seed.tcpResult.id)).not.toBeNull();
	expect(await db.find(cronJobMonitors, seed.cronJob.id)).not.toBeNull();
	expect(await db.find(cronJobPings, seed.cronPing.id)).not.toBeNull();
	expect(await db.find(alerts, seed.alert.id)).not.toBeNull();
	expect(await db.find(alertEvents, seed.alertEvent.id)).not.toBeNull();
	expect(await db.find(maintenanceWindows, seed.maintenanceWindow.id)).not.toBeNull();
	expect(await StatusPage.findByIdForTeam(db, seed.team.id, seed.statusPage.id)).not.toBeNull();
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
	expect(await Monitor.findByIdForTeam(db, seed.team.id, seed.monitor.id)).toBeNull();
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

describe("Team.findByIdOrSlug", () => {
	test("finds a team by its UUID id", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());

		expect((await Team.findByIdOrSlug(db, team.id))?.id).toBe(team.id);
	});

	test("finds a team by its slug", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken({ username: "acme" }));

		expect((await Team.findByIdOrSlug(db, team.slug))?.id).toBe(team.id);
	});

	test("returns null for an id that doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await Team.findByIdOrSlug(db, crypto.randomUUID())).toBeNull();
	});

	test("returns null for a slug that doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await Team.findByIdOrSlug(db, "no-such-slug")).toBeNull();
	});
});

describe("Team.findMembership", () => {
	test("finds a subject's membership on a team", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let team = await Team.createTeam(db, buildIdToken({ subject: subjectId }));

		let membership = await Team.findMembership(db, team.id, subjectId);
		expect(membership?.role).toBe("admin");
	});

	test("returns null when the subject isn't a member", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());

		expect(await Team.findMembership(db, team.id, crypto.randomUUID())).toBeNull();
	});
});

describe("Team.listMembersByTeam", () => {
	test("lists every membership row for a team", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let team = await Team.createTeam(db, buildIdToken({ subject: subjectId }));

		let rows = await Team.listMembersByTeam(db, team.id);
		expect(rows.map((row) => row.subject_id)).toEqual([subjectId]);
	});

	test("never returns another team's memberships", async () => {
		let { db } = createTestDatabase();
		await Team.createTeam(db, buildIdToken());
		let teamB = await Team.createTeam(db, buildIdToken());

		let members = await Team.listMembersByTeam(db, teamB.id);
		expect(members).toHaveLength(1);
	});
});

describe("Team.listBySubjectId", () => {
	test("lists every team a subject belongs to", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let team = await Team.createTeam(db, buildIdToken({ subject: subjectId }));

		let rows = await Team.listBySubjectId(db, subjectId);
		expect(rows.map((row) => row.id)).toEqual([team.id]);
	});

	test("returns an empty array for a subject with no memberships", async () => {
		let { db } = createTestDatabase();
		expect(await Team.listBySubjectId(db, crypto.randomUUID())).toEqual([]);
	});
});

describe("Team.joinByDomain", () => {
	test("joins the subject to every team whose verified domain matches their email, and returns the first", async () => {
		let { db } = createTestDatabase();
		let ownerTeam = await Team.createTeam(db, buildIdToken());
		let domain = await TeamDomain.create(db, ownerTeam.id, "acme.com");
		await TeamDomain.markVerified(db, domain.id);

		let joiner = buildIdToken({ email: "person@acme.com" });
		let joined = await Team.joinByDomain(db, joiner);

		expect(joined?.id).toBe(ownerTeam.id);
		expect((await Team.findMembership(db, ownerTeam.id, joiner.subject))?.role).toBe("member");
	});

	test("returns null and joins nothing when the domain isn't verified", async () => {
		let { db } = createTestDatabase();
		let ownerTeam = await Team.createTeam(db, buildIdToken());
		await TeamDomain.create(db, ownerTeam.id, "acme.com");

		let joiner = buildIdToken({ email: "person@acme.com" });
		expect(await Team.joinByDomain(db, joiner)).toBeNull();
		expect(await Team.findMembership(db, ownerTeam.id, joiner.subject)).toBeNull();
	});

	test("returns null when no domain matches the email's hostname at all", async () => {
		let { db } = createTestDatabase();
		let joiner = buildIdToken({ email: "person@nowhere.com" });
		expect(await Team.joinByDomain(db, joiner)).toBeNull();
	});

	test("joins every team with a matching verified domain, not just one", async () => {
		let { db } = createTestDatabase();
		let teamA = await Team.createTeam(db, buildIdToken());
		let teamB = await Team.createTeam(db, buildIdToken());
		let domainA = await TeamDomain.create(db, teamA.id, "acme.com");
		let domainB = await TeamDomain.create(db, teamB.id, "acme.com");
		await TeamDomain.markVerified(db, domainA.id);
		await TeamDomain.markVerified(db, domainB.id);

		let joiner = buildIdToken({ email: "person@acme.com" });
		await Team.joinByDomain(db, joiner);

		expect(await Team.findMembership(db, teamA.id, joiner.subject)).not.toBeNull();
		expect(await Team.findMembership(db, teamB.id, joiner.subject)).not.toBeNull();
	});

	test("throws when the email has no usable hostname", async () => {
		let { db } = createTestDatabase();
		let joiner = buildIdToken({ email: "" });
		await expect(Team.joinByDomain(db, joiner)).rejects.toThrow("Invalid email format");
	});
});

describe("Team.createTeam", () => {
	test("creates a personal team named after the subject and makes them its owning admin", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let idToken = buildIdToken({
			subject: subjectId,
			name: "Jane Doe",
			username: "JaneDoe",
			picture: "https://cdn.example.com/jane.png",
		});

		let team = await Team.createTeam(db, idToken);

		expect(team.owner_id).toBe(subjectId);
		expect(team.name).toBe("Jane Doe's Team");
		expect(team.slug).toBe("janedoe-team");
		expect(team.logo).toBe("https://cdn.example.com/jane.png");
		expect((await Team.findMembership(db, team.id, subjectId))?.role).toBe("admin");
	});

	test("falls back to a null logo when the token has no picture", async () => {
		let { db } = createTestDatabase();
		let idToken = buildIdToken({ picture: "" });

		let team = await Team.createTeam(db, idToken);
		expect(team.logo).toBeNull();
	});
});

describe("Team.createAdditional", () => {
	test("creates a team owned by the given subject with a slug derived from its name", async () => {
		let { db } = createTestDatabase();
		let ownerId = crypto.randomUUID();

		let team = await Team.createAdditional(db, ownerId, "Ops Team");

		expect(team.owner_id).toBe(ownerId);
		expect(team.name).toBe("Ops Team");
		expect(team.slug).toBe("ops-team");
		expect((await Team.findMembership(db, team.id, ownerId))?.role).toBe("admin");
	});

	test("appends a suffix when the derived slug collides with an existing team", async () => {
		let { db } = createTestDatabase();
		let first = await Team.createAdditional(db, crypto.randomUUID(), "Ops Team");
		let second = await Team.createAdditional(db, crypto.randomUUID(), "Ops Team");

		expect(second.slug).not.toBe(first.slug);
		expect(second.slug.startsWith("ops-team-")).toBe(true);
	});
});

describe("Team.uniqueSlug", () => {
	test("returns the candidate slug unchanged when it isn't taken", async () => {
		let { db } = createTestDatabase();
		expect(await Team.uniqueSlug(db, "fresh-slug")).toBe("fresh-slug");
	});

	test("appends a suffix until the slug no longer collides", async () => {
		let { db } = createTestDatabase();
		await Team.createAdditional(db, crypto.randomUUID(), "Taken");

		let slug = await Team.uniqueSlug(db, "taken");
		expect(slug).not.toBe("taken");
		expect(slug.startsWith("taken-")).toBe(true);
		expect(await Team.findByIdOrSlug(db, slug)).toBeNull();
	});
});

describe("Team.listWithRoleBySubjectId", () => {
	test("lists every team with the subject's role and owner status", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let ownedTeam = await Team.createTeam(db, buildIdToken({ subject: subjectId }));

		let otherOwnerId = crypto.randomUUID();
		let memberTeam = await Team.createAdditional(db, otherOwnerId, "Other Co");
		await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: subjectId, team_id: memberTeam.id, role: "member" },
			{ touch: true, returnRow: true },
		);

		let rows = await Team.listWithRoleBySubjectId(db, subjectId);
		let byTeamId = new Map(rows.map((row) => [row.team.id, row]));

		expect(byTeamId.get(ownedTeam.id)).toMatchObject({ role: "admin", isOwner: true });
		expect(byTeamId.get(memberTeam.id)).toMatchObject({ role: "member", isOwner: false });
	});

	test("returns an empty array for a subject with no memberships", async () => {
		let { db } = createTestDatabase();
		expect(await Team.listWithRoleBySubjectId(db, crypto.randomUUID())).toEqual([]);
	});
});

describe("Team.updateById", () => {
	test("updates a team's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());

		let updated = await Team.updateById(db, team.id, { name: "Renamed" });
		expect(updated.name).toBe("Renamed");
	});
});

describe("Team.setRole", () => {
	test("changes a subject's role on a team", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());
		let memberId = crypto.randomUUID();
		await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: memberId, team_id: team.id, role: "member" },
			{ touch: true, returnRow: true },
		);

		await Team.setRole(db, team.id, memberId, "admin");

		expect((await Team.findMembership(db, team.id, memberId))?.role).toBe("admin");
	});

	test("throws when the subject has no membership on the team", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());

		await expect(Team.setRole(db, team.id, crypto.randomUUID(), "admin")).rejects.toThrow(
			/No membership/,
		);
	});
});

describe("Team.removeMembership", () => {
	test("removes a subject's membership from a team", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let team = await Team.createTeam(db, buildIdToken({ subject: subjectId }));

		await Team.removeMembership(db, team.id, subjectId);

		expect(await Team.findMembership(db, team.id, subjectId)).toBeNull();
	});

	test("is a no-op when the subject isn't a member", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());

		await Team.removeMembership(db, team.id, crypto.randomUUID());
	});
});

describe("Team.deleteById", () => {
	test("cascades to every row the team owns, without touching another team's data", async () => {
		let { db } = createTestDatabase();
		let toDelete = await seedFullTeam(db, crypto.randomUUID());
		let untouched = await seedFullTeam(db, crypto.randomUUID());

		await expectSeedIntact(db, toDelete);
		await expectSeedIntact(db, untouched);

		await Team.deleteById(db, toDelete.team.id);

		await expectSeedGone(db, toDelete);
		await expectSeedIntact(db, untouched);
	});

	test("succeeds for a team with no owned rows besides its own membership", async () => {
		let { db } = createTestDatabase();
		let team = await Team.createTeam(db, buildIdToken());

		await Team.deleteById(db, team.id);

		expect(await db.find(teams, team.id)).toBeNull();
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
