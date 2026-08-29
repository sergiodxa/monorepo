/**
 * Tests the account export as a document: what a person's own export contains, and — the
 * half that matters — what it excludes. Every exclusion is asserted against the serialized
 * JSON, since that string is what leaves the building: a secret reachable through a getter,
 * a spread that pulled in one column too many, or a nested row nobody meant to include all
 * surface as a substring there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { describe, expect, test } from "vitest";

import type { AlertConfig, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import {
	accountExportFilename,
	ACCOUNT_EXPORT_FORMAT,
	buildAccountExport,
	MAX_EXPORTED_DNS_RECORDS_PER_TEAM,
} from "~/app/services/account-export";
import {
	alerts,
	apiKeys,
	dnsMonitorRecords,
	dnsMonitors,
	invites,
	memberships,
	monitorContentChecks,
	monitors,
	statusPageMonitors,
	statusPages,
	teams,
	userPreferences,
} from "~/database/schema";

const SUBJECT = { id: "subject-1", name: "Ada", email: "ada@example.com" };

async function createTeamRow(db: Database, overrides: Partial<SelectTeam> = {}) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: SUBJECT.id,
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function addMember(
	db: Database,
	teamId: string,
	subjectId: string,
	role: "member" | "admin" = "admin",
) {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: subjectId, role },
		{ touch: true, returnRow: true },
	);
}

async function addAlert(db: Database, teamId: string, config: AlertConfig) {
	return await db.create(
		alerts,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			monitor_id: null,
			name: "On failure",
			notify_on_recovery: true,
			cooldown_minutes: 60,
			config,
		},
		{ touch: true, returnRow: true },
	);
}

/** Creates a DNS monitor for `teamId`, with the columns the export reads back. */
async function addDnsMonitor(db: Database, teamId: string, name = "example.com") {
	return await db.create(
		dnsMonitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name,
			domain: name,
			zone_file_imported_at: Date.now(),
			interval_seconds: 86_400,
			next_due_at: null,
			is_enabled: true,
			last_checked_at: null,
			last_status: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function addDnsRecord(
	db: Database,
	monitorId: string,
	overrides: { name: string; value: string },
) {
	return await db.create(
		dnsMonitorRecords,
		{
			id: crypto.randomUUID(),
			dns_monitor_id: monitorId,
			record_type: "A",
			source: "zone_file",
			is_enabled: true,
			status: "ok",
			first_seen_at: Date.now(),
			last_seen_at: Date.now(),
			last_checked_at: Date.now(),
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

describe("buildAccountExport", () => {
	test("stamps the format, the version and the moment it was taken", async () => {
		let { db } = createTestDatabase();
		let now = new Date("2026-08-04T10:20:30.000Z");

		let document = await buildAccountExport(db, SUBJECT, now);

		expect(document.format).toBe(ACCOUNT_EXPORT_FORMAT);
		expect(document.version).toBe(1);
		expect(document.exportedAt).toBe("2026-08-04T10:20:30.000Z");
		expect(document.subject).toEqual(SUBJECT);
	});

	test("carries the viewer's own preferences, defaulting an untouched account to nothing chosen", async () => {
		let { db } = createTestDatabase();

		let empty = await buildAccountExport(db, SUBJECT);
		expect(empty.preferences).toEqual({ preferredLanguage: null, unsubscribedEmails: [] });

		await db.create(
			userPreferences,
			{
				id: crypto.randomUUID(),
				subject_id: SUBJECT.id,
				preferred_language: "es",
				unsubscribed_emails: ["teamDailyDigest"],
			},
			{ touch: true, returnRow: true },
		);

		let document = await buildAccountExport(db, SUBJECT);
		expect(document.preferences).toEqual({
			preferredLanguage: "es",
			unsubscribedEmails: ["teamDailyDigest"],
		});
	});

	test("lists one membership per team with the role and owner flag, and the owned team's configuration", async () => {
		let { db } = createTestDatabase();
		let owned = await createTeamRow(db, { name: "Owned" });
		let joined = await createTeamRow(db, { name: "Joined", owner_id: "someone-else" });
		await addMember(db, owned.id, SUBJECT.id, "admin");
		await addMember(db, joined.id, SUBJECT.id, "member");

		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: owned.id,
				author_id: SUBJECT.id,
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			monitorContentChecks,
			{ id: crypto.randomUUID(), monitor_id: monitor.id, type: "contains", value: "welcome" },
			{ touch: true, returnRow: true },
		);

		let document = await buildAccountExport(db, SUBJECT);

		expect(document.memberships).toHaveLength(2);
		let ownedMembership = document.memberships.find((entry) => entry.name === "Owned");
		let joinedMembership = document.memberships.find((entry) => entry.name === "Joined");
		expect(ownedMembership?.isOwner).toBe(true);
		expect(ownedMembership?.role).toBe("admin");
		expect(joinedMembership?.isOwner).toBe(false);
		expect(joinedMembership?.role).toBe("member");

		/**
		 * Configuration is exported only for teams the viewer owns; a team they merely
		 * joined is somebody else's setup.
		 */
		expect(document.ownedTeams).toHaveLength(1);
		expect(document.ownedTeams[0]?.name).toBe("Owned");
		expect(document.ownedTeams[0]?.httpMonitors).toHaveLength(1);
		expect(JSON.stringify(document)).toContain("welcome");
	});

	test("reports a team's membership as a count and never as a roster", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id, "admin");
		await addMember(db, team.id, "colleague-1", "member");
		await addMember(db, team.id, "colleague-2", "member");

		let document = await buildAccountExport(db, SUBJECT);
		let serialized = JSON.stringify(document);

		expect(document.memberships[0]?.memberCount).toBe(3);
		expect(serialized).not.toContain("colleague-1");
		expect(serialized).not.toContain("colleague-2");
	});

	test("excludes API keys entirely, hash and prefix both", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		await db.create(
			apiKeys,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "CI",
				key_hash: "hash-must-not-leak",
				key_prefix: "prefix-must-not-leak",
				scopes: ["monitors:read"],
			},
			{ touch: true, returnRow: true },
		);

		let serialized = JSON.stringify(await buildAccountExport(db, SUBJECT));

		expect(serialized).not.toContain("hash-must-not-leak");
		expect(serialized).not.toContain("prefix-must-not-leak");
	});

	test("keeps a webhook alert's URL but never its signing secret", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		await addAlert(db, team.id, {
			strategy: "webhook",
			config: { url: "https://hooks.example.com/uptime", secret: "signing-secret-must-not-leak" },
		});

		let document = await buildAccountExport(db, SUBJECT);
		let serialized = JSON.stringify(document);

		expect(document.ownedTeams[0]?.alerts[0]?.strategy).toBe("webhook");
		expect(document.ownedTeams[0]?.alerts[0]?.destination).toBe("https://hooks.example.com/uptime");
		expect(serialized).not.toContain("signing-secret-must-not-leak");
	});

	test("drops a Slack alert's webhook URL, which is the credential, and keeps the channel", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		await addAlert(db, team.id, {
			strategy: "slack",
			config: { webhookUrl: "https://hooks.slack.com/services/must-not-leak", channel: "#ops" },
		});

		let document = await buildAccountExport(db, SUBJECT);
		let serialized = JSON.stringify(document);

		expect(document.ownedTeams[0]?.alerts[0]?.destination).toBe("#ops");
		expect(serialized).not.toContain("must-not-leak");
	});

	test("drops a Discord alert's webhook URL and reports no destination for it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		await addAlert(db, team.id, {
			strategy: "discord",
			config: { webhookUrl: "https://discord.com/api/webhooks/must-not-leak" },
		});

		let document = await buildAccountExport(db, SUBJECT);

		expect(document.ownedTeams[0]?.alerts[0]?.destination).toBeNull();
		expect(JSON.stringify(document)).not.toContain("must-not-leak");
	});

	test("excludes invitee addresses, which are other people's data sitting in the viewer's team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				sender_id: SUBJECT.id,
				team_id: team.id,
				email: "invitee-must-not-leak@example.com",
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let serialized = JSON.stringify(await buildAccountExport(db, SUBJECT));

		expect(serialized).not.toContain("invitee-must-not-leak@example.com");
	});

	test("includes a status page and the services attached to it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: SUBJECT.id,
				name: "API",
				url: "https://api.example.com",
			},
			{ touch: true, returnRow: true },
		);
		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Public",
				slug: `public-${crypto.randomUUID()}`,
				title: "Acme Status",
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			statusPageMonitors,
			{ status_page_id: page.id, monitor_id: monitor.id, display_name: "API", order: 0 },
			{ returnRow: true },
		);

		let document = await buildAccountExport(db, SUBJECT);
		let exported = document.ownedTeams[0]?.statusPages[0] as { monitors: unknown[] };

		expect(document.ownedTeams[0]?.statusPages).toHaveLength(1);
		expect(exported.monitors).toHaveLength(1);
	});

	test("carries the records a DNS monitor tracks, which are its configuration", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		let monitor = await addDnsMonitor(db, team.id);
		await addDnsRecord(db, monitor.id, { name: "mail.example.com", value: "203.0.113.5" });
		await addDnsRecord(db, monitor.id, { name: "example.com", value: "203.0.113.1" });

		let document = await buildAccountExport(db, SUBJECT);
		let exported = document.ownedTeams[0]?.dnsMonitors[0] as {
			records: { name: string; value: string; dns_monitor_id?: string }[];
		};

		expect(exported.records).toHaveLength(2);
		/** Ordered by name, so two exports of an unchanged monitor are the same file. */
		expect(exported.records.map((record) => record.name)).toEqual([
			"example.com",
			"mail.example.com",
		]);
		/** The join column is the monitor this array already sits under, as with content checks. */
		expect(exported.records[0]?.dns_monitor_id).toBeUndefined();
		expect(JSON.stringify(document)).toContain("203.0.113.5");
		expect(document.ownedTeams[0]?.dnsRecordsTruncated).toBe(false);
	});

	test("stops at the record cap and says so, rather than dropping rows quietly", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT.id);
		let monitor = await addDnsMonitor(db, team.id);

		/**
		 * One row past the cap: the smallest input that shows the cap holds, since the
		 * overshoot row stays out of the file the assertions below check.
		 */
		for (let index = 0; index <= MAX_EXPORTED_DNS_RECORDS_PER_TEAM; index++) {
			await addDnsRecord(db, monitor.id, {
				name: `host-${index.toString().padStart(5, "0")}.example.com`,
				value: "203.0.113.1",
			});
		}

		let document = await buildAccountExport(db, SUBJECT);
		let exported = document.ownedTeams[0]?.dnsMonitors[0] as { records: unknown[] };

		expect(exported.records).toHaveLength(MAX_EXPORTED_DNS_RECORDS_PER_TEAM);
		expect(document.ownedTeams[0]?.dnsRecordsTruncated).toBe(true);
		expect(document.excluded.join(" ")).toContain("dnsRecordsTruncated");
	});

	test("says in the file itself what was left out, so an omission does not read as a bug", async () => {
		let { db } = createTestDatabase();

		let document = await buildAccountExport(db, SUBJECT);

		expect(document.excluded.length).toBeGreaterThan(0);
		expect(document.excluded.join(" ")).toContain("API keys");
		expect(document.excluded.join(" ")).toContain("Check history");
	});
});

describe("accountExportFilename", () => {
	test("names the file after the day and the subject, so two exports never collide", () => {
		let name = accountExportFilename("subject-1", new Date("2026-08-04T23:59:59.000Z"));

		expect(name).toBe("uptime-account-export-2026-08-04-subject-1.json");
	});
});
