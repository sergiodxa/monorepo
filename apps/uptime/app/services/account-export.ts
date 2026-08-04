/**
 * Assembles everything a signed-in person is entitled to take with them, as one JSON document
 * the account page serves as a download: who they are as far as this app knows, what they have
 * chosen, the teams they belong to, and the full monitoring configuration of the teams they
 * own.
 *
 * ## What is in it, and why that line
 *
 * The document answers "what do you hold about me, and what have I built here". So it carries
 * the subject's own identity and preferences, one entry per membership with the team's name and
 * their role in it, and — for owned teams only — the monitors of all four kinds, their content
 * checks, alerts, maintenance windows, status pages and the services attached to them, and the
 * team's verified domains. Owned teams get the configuration because the owner is the person
 * who would need it to rebuild the setup elsewhere; a team they merely joined is somebody
 * else's configuration and appears as the membership only.
 *
 * ## What is deliberately left out
 *
 * - **Secrets.** No API key hashes or prefixes (a hash is a credential's shadow and useless to
 *   its owner), no webhook signing secrets, and no Slack or Discord webhook URLs — those URLs
 *   *are* the credential, so an alert exported with one is an alert channel handed to whoever
 *   later opens the file. What survives per alert is the strategy and, where it is configuration
 *   rather than a credential, the destination: an HTTP webhook's URL, an email alert's address,
 *   a Slack channel name.
 * - **Other people.** No other member's subject id, name or address, no invitee addresses, and
 *   no per-member digest stamps. A team's membership appears as a count, which is what the
 *   exporter is entitled to know about their own team without being handed a roster.
 * - **Session and auth state.** Nothing from the session store and no ID token; the export is a
 *   record of stored data, not a set of live credentials.
 * - **Check history.** Individual results, pings and daily roll-ups are excluded. They are the
 *   configuration's output rather than anything the reader supplied, they run to millions of
 *   rows for a busy team, and the authoritative stream lives in an append-only analytics
 *   dataset this app cannot read back per person anyway. The document says so in `excluded` so
 *   a reader knows the omission is a decision and not a bug.
 *
 * The service reads only through the database handle it is given and imports nothing that
 * touches a Worker binding, so the settings page may link to it without dragging
 * `cloudflare:workers` into the client bundle.
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
	dnsMonitors: unknown[];
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
 * What the document tells its reader is missing.
 *
 * Written into the file rather than only into this module's docblock: the person holding the
 * download has no access to the source, and "my monitors are here but their history is not" is
 * exactly the kind of gap that reads as a broken export unless the file says otherwise.
 */
const EXCLUSIONS = [
	"API keys: the stored hash of a key is a credential's shadow and cannot be turned back into a usable key, so no key material or prefix is included.",
	"Alert secrets: webhook signing secrets and Slack/Discord webhook URLs are credentials for the channel itself and are omitted; the alert's strategy and its non-secret destination are included.",
	"Other people: no other member's identity, no invitee addresses, and no per-member email stamps. Teams report a member count instead.",
	"Session and sign-in data: nothing from the session store and no identity token. Your sign-in identity itself is held by the identity provider that signs you in, not by this app.",
	"Check history: individual monitor results, cron-job pings and daily roll-ups are not included. They are produced by the configuration above rather than supplied by you, and the authoritative stream is an append-only analytics dataset.",
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
 * Everything one owned team contributes. Monitors and status pages are exported as their stored
 * rows minus `team_id`/`status_page_id` bookkeeping, because every column on them is a setting
 * the owner chose or a cached last-known state that helps them read the file.
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

	return {
		teamId,
		name,
		slug,
		domains: domains.map((domain) => ({
			hostname: domain.hostname,
			verified: domain.verified_at !== null,
		})),
		// `team_id` is the team this object already sits under, and `author_id` is a subject id
		// — the exporter's own on their monitors, somebody else's on a team member's. Neither
		// belongs in the file, so both are dropped by name rather than filtered afterwards.
		httpMonitors: http.map(({ team_id: _team, author_id: _author, ...monitor }) => ({
			...monitor,
			contentChecks: contentChecks
				.filter((check) => check.monitor_id === monitor.id)
				.map(({ monitor_id: _monitor, ...check }) => check),
		})),
		dnsMonitors: dns.map(({ team_id: _team, ...monitor }) => monitor),
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
 * The part of an alert's configuration that is a setting rather than a credential.
 *
 * Slack and Discord answer `null` because their entire configuration is a webhook URL that acts
 * as the credential — anyone holding it can post to the channel — and a Slack channel name,
 * when one was given, is the readable half of that pair. An HTTP webhook's URL is exported and
 * its `secret` never is: the URL says where alerts go, the secret is what proves they came from
 * here.
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
