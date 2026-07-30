/**
 * Data-access model for status pages: CRUD, slug uniqueness, and curating which
 * HTTP/DNS/TCP monitors and cron-job monitors a page shows and in what order. Item
 * curation always replaces the full attached set for a page (delete every existing
 * row, then bulk-insert the new one) rather than diffing, since the form always posts
 * the complete selection each time — there's nothing to diff against.
 * `status_page_ssl_monitors` is deliberately never populated here: the underlying
 * `ssl_monitors` table has no rows in production (SSL status lives inline on `monitors`
 * instead — see Phase 5's dashboard card), so an SSL picker would always be empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { InsertStatusPage } from "~/database/schema";

import {
	statusPageCronJobs,
	statusPageDnsMonitors,
	statusPageMonitors,
	statusPages,
	statusPageTcpMonitors,
} from "~/database/schema";

/** The attached-item id lists a status page's edit form needs to pre-fill checkboxes. */
export interface StatusPageAttachedIds {
	monitorIds: string[];
	dnsMonitorIds: string[];
	tcpMonitorIds: string[];
	cronJobIds: string[];
}

export default class StatusPage {
	/** Creates a status page for a team. */
	static async create(db: Database, teamId: string, input: InsertStatusPage) {
		return await db.create(
			statusPages,
			{ id: generateUUID(), team_id: teamId, ...input },
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every status page for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(statusPages, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Finds a single status page scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, statusPageId: string) {
		return await db.findOne(statusPages, { where: { id: statusPageId, team_id: teamId } });
	}

	/** Finds a page by slug for the public `/status/:slug` route — private pages 404. */
	static async findBySlugPublic(db: Database, slug: string) {
		return await db.findOne(statusPages, { where: { slug, is_public: true } });
	}

	/** Whether `slug` is already used by a different status page (slugs are globally unique). */
	static async isSlugTaken(db: Database, slug: string, excludeId?: string) {
		let existing = await db.findOne(statusPages, { where: { slug } });
		return existing !== null && existing.id !== excludeId;
	}

	/** Updates a status page's editable fields. */
	static async updateById(db: Database, statusPageId: string, changes: Partial<InsertStatusPage>) {
		return await db.update(statusPages, statusPageId, changes, { touch: true });
	}

	/** Deletes a status page and every row attaching monitors to it. */
	static async deleteById(db: Database, statusPageId: string) {
		await db.deleteMany(statusPageMonitors, { where: { status_page_id: statusPageId } });
		await db.deleteMany(statusPageDnsMonitors, { where: { status_page_id: statusPageId } });
		await db.deleteMany(statusPageTcpMonitors, { where: { status_page_id: statusPageId } });
		await db.deleteMany(statusPageCronJobs, { where: { status_page_id: statusPageId } });
		return await db.delete(statusPages, statusPageId);
	}

	/** Replaces the full set of HTTP monitors attached to a page, in the given order. */
	static async setMonitors(db: Database, statusPageId: string, monitorIds: string[]) {
		await db.deleteMany(statusPageMonitors, { where: { status_page_id: statusPageId } });
		if (monitorIds.length === 0) return;
		await db.createMany(
			statusPageMonitors,
			monitorIds.map((monitorId, order) => ({
				status_page_id: statusPageId,
				monitor_id: monitorId,
				order,
			})),
		);
	}

	/** Replaces the full set of DNS monitors attached to a page, in the given order. */
	static async setDnsMonitors(db: Database, statusPageId: string, dnsMonitorIds: string[]) {
		await db.deleteMany(statusPageDnsMonitors, { where: { status_page_id: statusPageId } });
		if (dnsMonitorIds.length === 0) return;
		await db.createMany(
			statusPageDnsMonitors,
			dnsMonitorIds.map((dnsMonitorId, order) => ({
				id: generateUUID(),
				status_page_id: statusPageId,
				dns_monitor_id: dnsMonitorId,
				order,
			})),
		);
	}

	/** Replaces the full set of TCP monitors attached to a page, in the given order. */
	static async setTcpMonitors(db: Database, statusPageId: string, tcpMonitorIds: string[]) {
		await db.deleteMany(statusPageTcpMonitors, { where: { status_page_id: statusPageId } });
		if (tcpMonitorIds.length === 0) return;
		await db.createMany(
			statusPageTcpMonitors,
			tcpMonitorIds.map((tcpMonitorId, order) => ({
				id: generateUUID(),
				status_page_id: statusPageId,
				tcp_monitor_id: tcpMonitorId,
				order,
			})),
		);
	}

	/** Replaces the full set of cron-job monitors attached to a page, in the given order. */
	static async setCronJobs(db: Database, statusPageId: string, cronJobIds: string[]) {
		await db.deleteMany(statusPageCronJobs, { where: { status_page_id: statusPageId } });
		if (cronJobIds.length === 0) return;
		await db.createMany(
			statusPageCronJobs,
			cronJobIds.map((cronJobMonitorId, order) => ({
				status_page_id: statusPageId,
				cron_job_monitor_id: cronJobMonitorId,
				order,
			})),
		);
	}

	/** The ids of every monitor/DNS/TCP/cron-job currently attached to a page, for pre-filling an edit form. */
	static async getAttachedIds(db: Database, statusPageId: string): Promise<StatusPageAttachedIds> {
		let [monitors, dnsMonitors, tcpMonitors, cronJobs] = await Promise.all([
			db.findMany(statusPageMonitors, { where: { status_page_id: statusPageId } }),
			db.findMany(statusPageDnsMonitors, { where: { status_page_id: statusPageId } }),
			db.findMany(statusPageTcpMonitors, { where: { status_page_id: statusPageId } }),
			db.findMany(statusPageCronJobs, { where: { status_page_id: statusPageId } }),
		]);

		return {
			monitorIds: monitors.map((row) => row.monitor_id),
			dnsMonitorIds: dnsMonitors.map((row) => row.dns_monitor_id),
			tcpMonitorIds: tcpMonitors.map((row) => row.tcp_monitor_id),
			cronJobIds: cronJobs.map((row) => row.cron_job_monitor_id),
		};
	}

	/** Ordered join rows for the public page: which monitors/DNS/TCP/cron-jobs to show, in curated order. */
	static async listAttachments(db: Database, statusPageId: string) {
		let [monitors, dnsMonitors, tcpMonitors, cronJobs] = await Promise.all([
			db.findMany(statusPageMonitors, {
				where: { status_page_id: statusPageId },
				orderBy: ["order", "asc"],
			}),
			db.findMany(statusPageDnsMonitors, {
				where: { status_page_id: statusPageId },
				orderBy: ["order", "asc"],
			}),
			db.findMany(statusPageTcpMonitors, {
				where: { status_page_id: statusPageId },
				orderBy: ["order", "asc"],
			}),
			db.findMany(statusPageCronJobs, {
				where: { status_page_id: statusPageId },
				orderBy: ["order", "asc"],
			}),
		]);

		return { monitors, dnsMonitors, tcpMonitors, cronJobs };
	}
}
