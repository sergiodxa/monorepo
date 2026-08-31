/**
 * Data-access model for teams: lookup by id or slug, membership resolution and
 * changes, provisioning with an owning admin membership, auto-join by verified
 * domain, and update/delete. Deleting a team cascades to every row it owns —
 * monitors and their history, alerts, maintenance windows, status pages, API keys,
 * domains, invites, memberships. Canceling the owner's billing stays with the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdToken } from "@pkg/auth/id-token";
import type { Database } from "remix/data-table";

import { generateUUID, isUUID } from "@pkg/uuid";
import { inList } from "remix/data-table";

import type { InsertTeam, SelectTeam } from "~/database/schema";

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
	monitors,
	statusPageCronJobs,
	statusPageDnsMonitors,
	statusPageMonitors,
	statusPages,
	statusPageTcpMonitors,
	tcpMonitorResults,
	tcpMonitors,
	teamDomains,
	teams,
} from "~/database/schema";

export default class Team {
	/** Finds a team by its UUID primary key or its unique slug. */
	static async findByIdOrSlug(db: Database, idOrSlug: string) {
		let where = isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
		return await db.findOne(teams, { where });
	}

	/** Finds a subject's membership row for a given team, or `null` when not a member. */
	static async findMembership(db: Database, teamId: string, subjectId: string) {
		return await db.findOne(memberships, { where: { team_id: teamId, subject_id: subjectId } });
	}

	/**
	 * How many monitors each team has, of every type, as one grouped query. The
	 * denominator for apportioning a platform-wide sweep's cost across the teams that
	 * caused it (ADR-007 §5); a team with no monitors is absent, having caused none.
	 */
	static async countMonitorsByTeam(db: Database): Promise<Map<string, number>> {
		let result = await db.exec(
			`SELECT team_id AS teamId, COUNT(*) AS count
			   FROM (SELECT team_id FROM monitors
			         UNION ALL SELECT team_id FROM tcp_monitors
			         UNION ALL SELECT team_id FROM dns_monitors
			         UNION ALL SELECT team_id FROM cron_job_monitors)
			  GROUP BY team_id`,
		);

		let rows = (result.rows ?? []) as unknown as { teamId: string; count: number }[];
		return new Map(rows.map((row) => [row.teamId, Number(row.count)]));
	}

	/**
	 * Maps each of `teamIds` to its owner's subject id in one query: a metered event is
	 * billed to the owner, while sweeps that perform checks carry only `team_id` — one
	 * lookup per sweep resolves it. An id that names no team is absent from the map.
	 */
	static async ownerIdsByTeamIds(db: Database, teamIds: string[]): Promise<Map<string, string>> {
		if (teamIds.length === 0) return new Map();

		let rows = await db.findMany(teams, { where: inList("id", [...new Set(teamIds)]) });
		return new Map(rows.map((row) => [row.id, row.owner_id]));
	}

	/**
	 * The listed teams themselves, keyed by id, in one query, for callers that start from
	 * a set of team ids. An id that names no team is absent from the map, leaving the
	 * caller to decide what a team that disappeared between two queries means.
	 */
	static async findByIds(db: Database, teamIds: string[]): Promise<Map<string, SelectTeam>> {
		if (teamIds.length === 0) return new Map();

		let rows = await db.findMany(teams, { where: inList("id", [...new Set(teamIds)]) });
		return new Map(rows.map((row) => [row.id, row]));
	}

	/** Lists every membership row for a team. */
	static async listMembersByTeam(db: Database, teamId: string) {
		return await db.findMany(memberships, { where: { team_id: teamId } });
	}

	/** Lists every team a subject belongs to. */
	static async listBySubjectId(db: Database, subjectId: string) {
		let rows = await db.findMany(memberships, { where: { subject_id: subjectId } });
		if (rows.length === 0) return [];
		return await db.findMany(teams, {
			where: inList(
				"id",
				rows.map((row) => row.team_id),
			),
		});
	}

	/**
	 * Joins a subject to every team whose verified domain matches their email's
	 * hostname, and returns the first such team.
	 */
	static async joinByDomain(db: Database, idToken: IdToken) {
		let hostname = (idToken.email ?? "").split("@").at(-1);
		if (!hostname) throw new Error("Invalid email format");

		let domains = await db.findMany(teamDomains, { where: { hostname } });
		let verifiedDomains = domains.filter((domain) => domain.verified_at !== null);
		if (verifiedDomains.length === 0) return null;

		await Promise.allSettled(
			verifiedDomains.map((domain) =>
				db.create(
					memberships,
					{
						id: generateUUID(),
						subject_id: idToken.subject,
						team_id: domain.team_id,
						role: "member",
					},
					{ touch: true, returnRow: true },
				),
			),
		);

		let firstTeam = await db.findOne(teams, { where: { id: verifiedDomains[0]!.team_id } });
		if (!firstTeam) throw new Error("Failed to load the team joined by domain");
		return firstTeam;
	}

	/**
	 * Creates a personal team for a subject and makes them its owning admin. Name and
	 * username are optional at the identity provider, so the subject id stands in for
	 * either and a sparse profile still completes a sign-up.
	 */
	static async createTeam(db: Database, idToken: IdToken) {
		let username = idToken.username ?? idToken.subject;
		let team = await db.create(
			teams,
			{
				id: generateUUID(),
				owner_id: idToken.subject,
				name: `${idToken.name ?? username}'s Team`,
				slug: `${username.toLowerCase()}-team`,
				logo: idToken.picture || null,
			},
			{ touch: true, returnRow: true },
		);

		await db.create(
			memberships,
			{ id: generateUUID(), subject_id: idToken.subject, team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		return team;
	}

	/** Creates an additional team owned by `ownerId`, deriving a unique slug from `name`. */
	static async createAdditional(db: Database, ownerId: string, name: string) {
		let slug = await Team.uniqueSlug(db, generateTeamSlug(name));

		let team = await db.create(
			teams,
			{ id: generateUUID(), owner_id: ownerId, name, slug, logo: null },
			{ touch: true, returnRow: true },
		);

		await db.create(
			memberships,
			{ id: generateUUID(), subject_id: ownerId, team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		return team;
	}

	/** Appends a short suffix to `slug` until it no longer collides with an existing team. */
	static async uniqueSlug(db: Database, slug: string): Promise<string> {
		let candidate = slug;
		while (await db.findOne(teams, { where: { slug: candidate } })) {
			candidate = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
		}
		return candidate;
	}

	/** Lists every team a subject belongs to, alongside their role and owner status. */
	static async listWithRoleBySubjectId(db: Database, subjectId: string) {
		let rows = await db.findMany(memberships, { where: { subject_id: subjectId } });
		if (rows.length === 0) return [];

		let roleByTeamId = new Map(
			rows.map((row): [string, "member" | "admin"] => [
				row.team_id,
				row.role as "member" | "admin",
			]),
		);
		let teamRows = await db.findMany(teams, {
			where: inList(
				"id",
				rows.map((row) => row.team_id),
			),
		});

		return teamRows.map((team) => ({
			team,
			role: roleByTeamId.get(team.id) ?? "member",
			isOwner: team.owner_id === subjectId,
		}));
	}

	/** Updates a team's editable fields. */
	static async updateById(db: Database, teamId: string, changes: Partial<InsertTeam>) {
		return await db.update(teams, teamId, changes, { touch: true });
	}

	/** Adds or changes a subject's role on a team. */
	static async setRole(db: Database, teamId: string, subjectId: string, role: "member" | "admin") {
		let membership = await Team.findMembership(db, teamId, subjectId);
		if (!membership) throw new Error(`No membership for subject ${subjectId} on team ${teamId}`);
		return await db.update(memberships, membership.id, { role }, { touch: true });
	}

	/** Removes a subject's membership from a team (used for both admin-removal and self-leave). */
	static async removeMembership(db: Database, teamId: string, subjectId: string) {
		let membership = await Team.findMembership(db, teamId, subjectId);
		if (!membership) return;
		await db.delete(memberships, membership.id);
	}

	/**
	 * Deletes a team and every row it owns, directly or transitively: monitors of every
	 * type and their history, alerts and events, maintenance windows, status pages and
	 * their attachments, API keys, domains, invites, and memberships. Cancel billing first.
	 */
	static async deleteById(db: Database, teamId: string) {
		let [httpMonitors, dnsMonitorRows, tcpMonitorRows, cronJobRows, alertRows, statusPageRows] =
			await Promise.all([
				db.findMany(monitors, { where: { team_id: teamId } }),
				db.findMany(dnsMonitors, { where: { team_id: teamId } }),
				db.findMany(tcpMonitors, { where: { team_id: teamId } }),
				db.findMany(cronJobMonitors, { where: { team_id: teamId } }),
				db.findMany(alerts, { where: { team_id: teamId } }),
				db.findMany(statusPages, { where: { team_id: teamId } }),
			]);

		let monitorIds = [
			...httpMonitors.map((row) => row.id),
			...dnsMonitorRows.map((row) => row.id),
			...tcpMonitorRows.map((row) => row.id),
			...cronJobRows.map((row) => row.id),
		];

		if (httpMonitors.length > 0) {
			let where = inList(
				"monitor_id",
				httpMonitors.map((row) => row.id),
			);
			await db.deleteMany(monitorResults, { where });
			await db.deleteMany(monitorContentChecks, { where });
		}
		if (dnsMonitorRows.length > 0) {
			await db.deleteMany(dnsMonitorResults, {
				where: inList(
					"dns_monitor_id",
					dnsMonitorRows.map((row) => row.id),
				),
			});
		}
		if (tcpMonitorRows.length > 0) {
			await db.deleteMany(tcpMonitorResults, {
				where: inList(
					"tcp_monitor_id",
					tcpMonitorRows.map((row) => row.id),
				),
			});
		}
		if (cronJobRows.length > 0) {
			await db.deleteMany(cronJobPings, {
				where: inList(
					"cron_job_monitor_id",
					cronJobRows.map((row) => row.id),
				),
			});
		}
		if (monitorIds.length > 0) {
			await db.deleteMany(monitorDailyStats, { where: inList("monitor_id", monitorIds) });
		}
		if (alertRows.length > 0) {
			await db.deleteMany(alertEvents, {
				where: inList(
					"alert_id",
					alertRows.map((row) => row.id),
				),
			});
		}
		for (let statusPage of statusPageRows) {
			await db.deleteMany(statusPageMonitors, { where: { status_page_id: statusPage.id } });
			await db.deleteMany(statusPageDnsMonitors, { where: { status_page_id: statusPage.id } });
			await db.deleteMany(statusPageTcpMonitors, { where: { status_page_id: statusPage.id } });
			await db.deleteMany(statusPageCronJobs, { where: { status_page_id: statusPage.id } });
		}

		await db.deleteMany(monitors, { where: { team_id: teamId } });
		await db.deleteMany(dnsMonitors, { where: { team_id: teamId } });
		await db.deleteMany(tcpMonitors, { where: { team_id: teamId } });
		await db.deleteMany(cronJobMonitors, { where: { team_id: teamId } });
		await db.deleteMany(alerts, { where: { team_id: teamId } });
		await db.deleteMany(maintenanceWindows, { where: { team_id: teamId } });
		await db.deleteMany(statusPages, { where: { team_id: teamId } });
		await db.deleteMany(apiKeys, { where: { team_id: teamId } });
		await db.deleteMany(teamDomains, { where: { team_id: teamId } });
		await db.deleteMany(invites, { where: { team_id: teamId } });
		await db.deleteMany(memberships, { where: { team_id: teamId } });
		await db.delete(teams, teamId);
	}
}

/**
 * Derives a URL-safe slug from a team name: lowercased, non-alphanumeric characters
 * stripped, whitespace hyphenated, and capped at 50 characters.
 */
export function generateTeamSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.slice(0, 50);
}
