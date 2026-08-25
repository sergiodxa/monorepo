/**
 * Assembles everything a signed-in subject is entitled to take with them — identity,
 * preferences, team memberships, and the monitoring configuration of teams they own.
 *
 * Secrets, other members' identities, session state, and check history are excluded;
 * DNS records beyond a cap are truncated and disclosed via `dnsRecordsTruncated`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { inList } from "remix/data-table";

import type {
	AlertConfig,
	OptionalEmail,
	SelectStatusPage,
	SupportedLanguage,
} from "~/database/schema";

import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import {
	alerts,
	cronJobMonitors,
	dnsMonitorRecords,
	dnsMonitors,
	maintenanceWindows,
	monitorContentChecks,
	monitors,
	statusPageCronJobs,
	statusPageDnsMonitors,
	statusPageMonitors,
	statusPages,
	statusPageTcpMonitors,
	tcpMonitors,
	teamDomains,
} from "~/database/schema";

/**
 * Format identifier and version, so a file found on a disk in two years can be recognised and
 * so a later change of shape is a version bump rather than a silent difference.
 */
export const ACCOUNT_EXPORT_FORMAT = "uptime.account-export";

/** Current version of {@link ACCOUNT_EXPORT_FORMAT}. */
export const ACCOUNT_EXPORT_VERSION = 1;

/**
 * How many tracked DNS records one team may contribute before the export stops reading
 * them. Records come from a pasted zone rather than typed entries, so one team can dwarf
 * the file; reaching the cap is disclosed via {@link ExportedOwnedTeam.dnsRecordsTruncated}.
 */
export const MAX_EXPORTED_DNS_RECORDS_PER_TEAM = 5_000;

/** Who the export is about, taken from the ID token on the request rather than from a table. */
export interface ExportSubject {
	id: string;
	name: string;
	email: string;
}

/** One membership: the team as the exporter sees it, plus their standing in it. */
export interface ExportedMembership {
	teamId: string;
	name: string;
	slug: string;
	role: "member" | "admin";
	isOwner: boolean;
	joinedAt: string | null;
	/** How many people are in the team, including the exporter. A count, never a roster. */
	memberCount: number;
}

/** One alert, with its credential-bearing configuration reduced to a safe destination. */
export interface ExportedAlert {
	id: string;
	name: string;
	monitorId: string | null;
	notifyOnRecovery: boolean;
	cooldownMinutes: number;
	strategy: AlertConfig["strategy"];
	/**
	 * Where the alert goes, when that is configuration rather than a credential: a webhook's
	 * URL, an email's address, a Slack channel. `null` for a strategy whose only destination is
	 * a secret URL, which is not exported.
	 */
	destination: string | null;
}

/** The monitoring configuration of one team the exporter owns. */
export interface ExportedOwnedTeam {
	teamId: string;
	name: string;
	slug: string;
	domains: { hostname: string; verified: boolean }[];
	httpMonitors: unknown[];
	/** Each monitor with the records it tracks nested under it, as `records`. */
	dnsMonitors: unknown[];
	/**
	 * Whether {@link MAX_EXPORTED_DNS_RECORDS_PER_TEAM} cut the record list short. Always
	 * present, so a reader can tell "no records" from "records the file stopped listing".
	 */
	dnsRecordsTruncated: boolean;
	tcpMonitors: unknown[];
	cronJobMonitors: unknown[];
	alerts: ExportedAlert[];
	maintenanceWindows: unknown[];
	statusPages: unknown[];
}

/** The whole document, as it is serialized into the downloaded file. */
export interface AccountExportDocument {
	format: typeof ACCOUNT_EXPORT_FORMAT;
	version: typeof ACCOUNT_EXPORT_VERSION;
	exportedAt: string;
	subject: ExportSubject;
	preferences: {
		preferredLanguage: SupportedLanguage | null;
		unsubscribedEmails: OptionalEmail[];
	};
	memberships: ExportedMembership[];
	ownedTeams: ExportedOwnedTeam[];
	/** Plain-language notes on what is not here, so an omission reads as a decision. */
	excluded: string[];
}

/**
 * What the document tells its reader is missing, written into the file itself rather than
 * only documented here: the person holding the download cannot see the source, so an
 * omission must say so or it reads as a broken export.
 */
const EXCLUSIONS = [
	"API keys: the stored hash of a key is a credential's shadow and cannot be turned back into a usable key, so no key material or prefix is included.",
	"Alert secrets: webhook signing secrets and Slack/Discord webhook URLs are credentials for the channel itself and are omitted; the alert's strategy and its non-secret destination are included.",
	"Other people: no other member's identity, no invitee addresses, and no per-member email stamps. Teams report a member count instead.",
	"Session and sign-in data: nothing from the session store and no identity token. Your sign-in identity itself is held by the identity provider that signs you in, not by this app.",
	"Check history: individual monitor results, cron-job pings and daily roll-ups are not included. They are produced by the configuration above rather than supplied by you, and the authoritative stream is an append-only analytics dataset.",
	`DNS records beyond ${MAX_EXPORTED_DNS_RECORDS_PER_TEAM} per team: the records a DNS monitor tracks are the one part of this file whose size you do not type by hand, so the export stops there and says so on the team as "dnsRecordsTruncated".`,
	"Zone files: the text pasted to import DNS records is never stored anywhere, so there is no copy of it to give back. The records it produced are listed above.",
] as const;

/**
 * Builds the export document for one signed-in subject.
 *
 * @param db - Database handle.
 * @param subject - The exporter, as the ID token on the request describes them.
 * @param now - Timestamp recorded as `exportedAt`; injectable so a test can assert it.
 * @returns The document, ready to be serialized.
 */
export async function buildAccountExport(
	db: Database,
	subject: ExportSubject,
	now: Date = new Date(),
): Promise<AccountExportDocument> {
	let [rows, preferences] = await Promise.all([
		Team.listWithRoleBySubjectId(db, subject.id),
		UserPreferences.findBySubjectId(db, subject.id),
	]);

	let memberships: ExportedMembership[] = [];
	let ownedTeams: ExportedOwnedTeam[] = [];

	for (let { team, role, isOwner } of rows) {
		let members = await Team.listMembersByTeam(db, team.id);
		let own = members.find((member) => member.subject_id === subject.id);

		memberships.push({
			teamId: team.id,
			name: team.name,
			slug: team.slug,
			role,
			isOwner,
			joinedAt: own ? new Date(own.created_at).toISOString() : null,
			memberCount: members.length,
		});

		if (isOwner) ownedTeams.push(await exportOwnedTeam(db, team.id, team.name, team.slug));
	}

	return {
		format: ACCOUNT_EXPORT_FORMAT,
		version: ACCOUNT_EXPORT_VERSION,
		exportedAt: now.toISOString(),
		subject,
		preferences: {
			preferredLanguage: preferences?.preferred_language ?? null,
			unsubscribedEmails: preferences?.unsubscribed_emails ?? [],
		},
		memberships,
		ownedTeams,
		excluded: [...EXCLUSIONS],
	};
}

/**
 * The filename the download is offered under: stable prefix, the UTC date, and the subject id,
 * so two exports taken on different days sort next to each other and neither overwrites the
 * other in a downloads folder.
 */
export function accountExportFilename(subjectId: string, now: Date = new Date()): string {
	let day = now.toISOString().slice(0, 10);
	return `uptime-account-export-${day}-${subjectId}.json`;
}

/**
 * Everything one owned team contributes, as stored rows minus `team_id`/`status_page_id`
 * bookkeeping. DNS records are read once for the team in a stable order, one row past the
 * cap, so a truncated read is detected without a second counting query.
 */
async function exportOwnedTeam(
	db: Database,
	teamId: string,
	name: string,
	slug: string,
): Promise<ExportedOwnedTeam> {
	let [http, dns, tcp, cron, alertRows, windows, pages, domains] = await Promise.all([
		db.findMany(monitors, { where: { team_id: teamId } }),
		db.findMany(dnsMonitors, { where: { team_id: teamId } }),
		db.findMany(tcpMonitors, { where: { team_id: teamId } }),
		db.findMany(cronJobMonitors, { where: { team_id: teamId } }),
		db.findMany(alerts, { where: { team_id: teamId } }),
		db.findMany(maintenanceWindows, { where: { team_id: teamId } }),
		db.findMany(statusPages, { where: { team_id: teamId } }),
		db.findMany(teamDomains, { where: { team_id: teamId } }),
	]);

	let contentChecks =
		http.length === 0
			? []
			: await db.findMany(monitorContentChecks, {
					where: inList(
						"monitor_id",
						http.map((monitor) => monitor.id),
					),
				});

	let dnsRecords =
		dns.length === 0
			? []
			: await db.findMany(dnsMonitorRecords, {
					where: inList(
						"dns_monitor_id",
						dns.map((monitor) => monitor.id),
					),
					orderBy: [
						["dns_monitor_id", "asc"],
						["name", "asc"],
						["record_type", "asc"],
						["value", "asc"],
					],
					limit: MAX_EXPORTED_DNS_RECORDS_PER_TEAM + 1,
				});

	let dnsRecordsTruncated = dnsRecords.length > MAX_EXPORTED_DNS_RECORDS_PER_TEAM;
	let exportedDnsRecords = dnsRecordsTruncated
		? dnsRecords.slice(0, MAX_EXPORTED_DNS_RECORDS_PER_TEAM)
		: dnsRecords;

	return {
		teamId,
		name,
		slug,
		domains: domains.map((domain) => ({
			hostname: domain.hostname,
			verified: domain.verified_at !== null,
		})),
		httpMonitors: http.map(({ team_id: _team, author_id: _author, ...monitor }) => ({
			...monitor,
			contentChecks: contentChecks
				.filter((check) => check.monitor_id === monitor.id)
				.map(({ monitor_id: _monitor, ...check }) => check),
		})),
		dnsMonitors: dns.map(({ team_id: _team, ...monitor }) => ({
			...monitor,
			records: exportedDnsRecords
				.filter((record) => record.dns_monitor_id === monitor.id)
				.map(({ dns_monitor_id: _monitor, ...record }) => record),
		})),
		dnsRecordsTruncated,
		tcpMonitors: tcp.map(({ team_id: _team, ...monitor }) => monitor),
		cronJobMonitors: cron.map(({ team_id: _team, ...monitor }) => monitor),
		alerts: alertRows.map((alert) => ({
			id: alert.id,
			name: alert.name,
			monitorId: alert.monitor_id,
			notifyOnRecovery: alert.notify_on_recovery,
			cooldownMinutes: alert.cooldown_minutes,
			strategy: alert.config.strategy,
			destination: alertDestination(alert.config),
		})),
		maintenanceWindows: windows.map(({ team_id: _team, ...window }) => window),
		statusPages: await Promise.all(pages.map((page) => exportStatusPage(db, page))),
	};
}

/**
 * The part of an alert's configuration that is a setting rather than a credential. Slack
 * and Discord return `null` because their configuration is itself a webhook URL — the
 * credential — while an HTTP webhook exports its URL and keeps its `secret` out of the file.
 */
function alertDestination(config: AlertConfig): string | null {
	if (config.strategy === "webhook") return config.config.url;
	if (config.strategy === "email") return config.config.to;
	if (config.strategy === "slack") return config.config.channel ?? null;
	return null;
}

/** One status page plus the services attached to it, by id and display order. */
async function exportStatusPage(db: Database, page: SelectStatusPage) {
	let [attachedMonitors, attachedDns, attachedTcp, attachedCron] = await Promise.all([
		db.findMany(statusPageMonitors, { where: { status_page_id: page.id } }),
		db.findMany(statusPageDnsMonitors, { where: { status_page_id: page.id } }),
		db.findMany(statusPageTcpMonitors, { where: { status_page_id: page.id } }),
		db.findMany(statusPageCronJobs, { where: { status_page_id: page.id } }),
	]);

	let { team_id: _team, ...rest } = page;

	return {
		...rest,
		monitors: attachedMonitors.map(({ status_page_id: _page, ...row }) => row),
		dnsMonitors: attachedDns.map(({ status_page_id: _page, ...row }) => row),
		tcpMonitors: attachedTcp.map(({ status_page_id: _page, ...row }) => row),
		cronJobs: attachedCron.map(({ status_page_id: _page, ...row }) => row),
	};
}
