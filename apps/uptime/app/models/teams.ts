/**
 * Teams: what owns every monitor, alert, status page and key, billed to their owner. A team
 * is created with its owner as an admin member, and deleting one removes every row it owns,
 * directly or transitively. Cancelling the owner's billing stays with the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdToken } from "@sdxc/auth/id-token";
import type { ModelContext, ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { systemRandom } from "@sdxc/random";
import { isUUID } from "@sdxc/uuid";
import { generateUUID } from "@sdxc/uuid/v4";
import { inList } from "remix/data-table";

import type { MembershipRole } from "~/app/models/memberships";
import type { SelectTeam } from "~/database/schema";

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

/** One team a subject belongs to, with their standing in it. */
export interface TeamWithRole {
	team: SelectTeam;
	role: MembershipRole;
	isOwner: boolean;
}

export const Teams = createModel(teams, {
	optional: ["id"],

	methods: {
		/** Finds a team by its UUID primary key or its unique slug, whichever the URL carries. */
		findByIdOrSlug(idOrSlug: string) {
			return this.query()
				.where(isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug })
				.first();
		},

		/**
		 * The listed teams, keyed by id, in one query, for callers that start from a set of team
		 * ids. An id that names no team is absent from the map, leaving the caller to decide what
		 * a team that disappeared between two queries means.
		 */
		async findByIds(teamIds: string[]): Promise<Map<string, SelectTeam>> {
			if (teamIds.length === 0) return new Map();

			let rows = await this.query()
				.where(inList("id", [...new Set(teamIds)]))
				.all();
			return new Map(rows.map((row) => [row.id, row]));
		},

		/**
		 * Maps each of `teamIds` to its owner's subject id in one query: a metered event is
		 * billed to the owner, while sweeps that perform checks carry only `team_id`. An id
		 * that names no team is absent from the map.
		 */
		async ownerIdsByTeamIds(teamIds: string[]): Promise<Map<string, string>> {
			let found = await this.findByIds(teamIds);
			return new Map([...found].map(([id, team]) => [id, team.owner_id]));
		},

		/**
		 * How many monitors each team has, of every type, as one grouped query: the denominator
		 * for apportioning a platform-wide sweep's cost across the teams that caused it. A team
		 * with no monitors is absent, having caused none.
		 */
		async countMonitorsByTeam(): Promise<Map<string, number>> {
			let result = await this.db.exec(
				`SELECT team_id AS teamId, COUNT(*) AS count
				   FROM (SELECT team_id FROM monitors
				         UNION ALL SELECT team_id FROM tcp_monitors
				         UNION ALL SELECT team_id FROM dns_monitors
				         UNION ALL SELECT team_id FROM cron_job_monitors
				         UNION ALL SELECT team_id FROM flow_monitors)
				  GROUP BY team_id`,
			);

			let rows = (result.rows ?? []) as unknown as { teamId: string; count: number }[];
			return new Map(rows.map((row) => [row.teamId, Number(row.count)]));
		},

		/** Every team a subject belongs to, in no particular order. */
		async listForSubject(subjectId: string): Promise<SelectTeam[]> {
			let rows = await this.db.findMany(memberships, { where: { subject_id: subjectId } });
			if (rows.length === 0) return [];

			return await this.query()
				.where(
					inList(
						"id",
						rows.map((row) => row.team_id),
					),
				)
				.all();
		},

		/** Every team a subject belongs to, alongside their role and whether they own it. */
		async listWithRoleForSubject(subjectId: string): Promise<TeamWithRole[]> {
			let rows = await this.db.findMany(memberships, { where: { subject_id: subjectId } });
			if (rows.length === 0) return [];

			let roleByTeamId = new Map(
				rows.map((row): [string, MembershipRole] => [row.team_id, row.role as MembershipRole]),
			);
			let teamRows = await this.query()
				.where(
					inList(
						"id",
						rows.map((row) => row.team_id),
					),
				)
				.all();

			return teamRows.map((team) => ({
				team,
				role: roleByTeamId.get(team.id) ?? "member",
				isOwner: team.owner_id === subjectId,
			}));
		},

		/**
		 * Appends a six-character base-36 suffix to `slug` until it no longer collides with an
		 * existing team. The suffix is a tie-breaker, so it draws from a well-spread source and
		 * carries no secrecy.
		 */
		async uniqueSlug(slug: string): Promise<string> {
			let random = systemRandom();
			let candidate = slug;
			while (await this.findBy({ slug: candidate })) {
				let suffix = random
					.int(0, 36 ** 6 - 1)
					.toString(36)
					.padStart(6, "0");
				candidate = `${slug}-${suffix}`;
			}
			return candidate;
		},

		/**
		 * Creates the personal team a subject gets on first sign-in. Name and username are
		 * optional at the identity provider, so the subject id stands in for either and a sparse
		 * profile still completes a sign-up.
		 */
		createPersonal(idToken: IdToken) {
			let username = idToken.username ?? idToken.subject;
			return this.create({
				owner_id: idToken.subject,
				name: `${idToken.name ?? username}'s Team`,
				slug: `${username.toLowerCase()}-team`,
				logo: idToken.picture || null,
			});
		},

		/** Creates an additional team owned by `ownerId`, deriving a unique slug from `name`. */
		async createAdditional(ownerId: string, name: string) {
			let slug = await this.uniqueSlug(generateTeamSlug(name));
			return await this.create({ owner_id: ownerId, name, slug, logo: null });
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},

		/**
		 * Makes the owner an admin member of the team just created, so no team exists that its
		 * owner cannot open. When that write fails the team row is removed again, leaving no
		 * ownerless team behind on a database without rollback.
		 */
		async afterCreate(team, ctx) {
			try {
				await ctx.db.create(memberships, {
					id: generateUUID(),
					subject_id: team.owner_id,
					team_id: team.id,
					role: "admin",
				});
			} catch (error) {
				await ctx.db.delete(teams, team.id);
				throw error;
			}
		},

		/**
		 * Deletes every row the team owns before the team itself: monitors of every type and
		 * their history, alerts and events, maintenance windows, status pages and their
		 * attachments, API keys, domains, invites, and memberships.
		 */
		async beforeDelete(team, ctx) {
			await deleteOwnedRows(ctx, team.id);
		},
	},
});

/** A team, as reads return it. */
export type Team = ModelRow<typeof Teams>;

/**
 * Deletes everything a team owns, children before parents, one statement per table. Every
 * statement is scoped to the team's own ids, so a partial run leaves only the team's rows
 * half-deleted, and running it again finishes the job.
 */
async function deleteOwnedRows(ctx: ModelContext, teamId: string): Promise<void> {
	let db = ctx.db;
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

export default Teams;
