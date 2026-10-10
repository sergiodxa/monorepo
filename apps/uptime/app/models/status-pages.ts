/**
 * A team's status pages: globally unique slugs, the public lookup, and which HTTP, DNS, TCP,
 * flow and cron-job monitors a page shows in what order. Curation replaces the full attached
 * set each time, since the form posts the complete selection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName } from "remix/data-table";

import type {
	FlowStatus,
	SelectStatusPage,
	SelectStatusPageCronJob,
	SelectStatusPageDnsMonitor,
	SelectStatusPageFlowMonitor,
	SelectStatusPageMonitor,
	SelectStatusPageTcpMonitor,
} from "~/database/schema";

import {
	flowMonitors,
	statusPageCronJobs,
	statusPageDnsMonitors,
	statusPageFlowMonitors,
	statusPageMonitors,
	statusPages,
	statusPageTcpMonitors,
} from "~/database/schema";

/** The attached-item id lists a status page's edit form needs to pre-fill checkboxes. */
export interface StatusPageAttachedIds {
	monitorIds: string[];
	dnsMonitorIds: string[];
	tcpMonitorIds: string[];
	flowMonitorIds: string[];
	cronJobIds: string[];
}

/** A page's attachment rows of every kind, each in its curated order. */
export interface StatusPageAttachments {
	monitors: SelectStatusPageMonitor[];
	dnsMonitors: SelectStatusPageDnsMonitor[];
	tcpMonitors: SelectStatusPageTcpMonitor[];
	flowMonitors: SelectStatusPageFlowMonitor[];
	cronJobs: SelectStatusPageCronJob[];
}

/**
 * A flow monitor as a public status page is allowed to know it. The spec `source` holds the
 * credentials the flow signs in with, so this path selects only these columns, and a leak
 * would have to be written into its `SELECT`.
 */
export interface PublicFlowMonitor {
	id: string;
	name: string;
	last_status: FlowStatus | null;
}

export const StatusPages = createModel(statusPages, {
	optional: ["id", "is_public", "show_overall_status"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},

	methods: {
		/** Finds a page by slug for the public `/status/:slug` routes; a private page reads as missing. */
		findPublic(slug: string): Promise<SelectStatusPage | null> {
			return this.findBy({ slug, is_public: true });
		},

		/** Whether `slug` is already used by a different status page; slugs are globally unique. */
		async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
			let existing = await this.findBy({ slug });
			return existing !== null && existing.id !== excludeId;
		},

		/** Replaces the full set of HTTP monitors attached to a page, in the given order. */
		async setMonitors(statusPageId: string, monitorIds: string[]): Promise<void> {
			await this.db.deleteMany(statusPageMonitors, { where: { status_page_id: statusPageId } });
			if (monitorIds.length === 0) return;
			await this.db.createMany(
				statusPageMonitors,
				monitorIds.map((monitorId, order) => ({
					status_page_id: statusPageId,
					monitor_id: monitorId,
					order,
				})),
			);
		},

		/** Replaces the full set of DNS monitors attached to a page, in the given order. */
		async setDnsMonitors(statusPageId: string, dnsMonitorIds: string[]): Promise<void> {
			await this.db.deleteMany(statusPageDnsMonitors, { where: { status_page_id: statusPageId } });
			if (dnsMonitorIds.length === 0) return;
			await this.db.createMany(
				statusPageDnsMonitors,
				dnsMonitorIds.map((dnsMonitorId, order) => ({
					id: generateUUID(),
					status_page_id: statusPageId,
					dns_monitor_id: dnsMonitorId,
					order,
				})),
			);
		},

		/** Replaces the full set of TCP monitors attached to a page, in the given order. */
		async setTcpMonitors(statusPageId: string, tcpMonitorIds: string[]): Promise<void> {
			await this.db.deleteMany(statusPageTcpMonitors, { where: { status_page_id: statusPageId } });
			if (tcpMonitorIds.length === 0) return;
			await this.db.createMany(
				statusPageTcpMonitors,
				tcpMonitorIds.map((tcpMonitorId, order) => ({
					id: generateUUID(),
					status_page_id: statusPageId,
					tcp_monitor_id: tcpMonitorId,
					order,
				})),
			);
		},

		/** Replaces the full set of flow monitors attached to a page, in the given order. */
		async setFlowMonitors(statusPageId: string, flowMonitorIds: string[]): Promise<void> {
			await this.db.deleteMany(statusPageFlowMonitors, {
				where: { status_page_id: statusPageId },
			});
			if (flowMonitorIds.length === 0) return;
			await this.db.createMany(
				statusPageFlowMonitors,
				flowMonitorIds.map((flowMonitorId, order) => ({
					id: generateUUID(),
					status_page_id: statusPageId,
					flow_monitor_id: flowMonitorId,
					order,
				})),
			);
		},

		/** Replaces the full set of cron-job monitors attached to a page, in the given order. */
		async setCronJobs(statusPageId: string, cronJobIds: string[]): Promise<void> {
			await this.db.deleteMany(statusPageCronJobs, { where: { status_page_id: statusPageId } });
			if (cronJobIds.length === 0) return;
			await this.db.createMany(
				statusPageCronJobs,
				cronJobIds.map((cronJobMonitorId, order) => ({
					status_page_id: statusPageId,
					cron_job_monitor_id: cronJobMonitorId,
					order,
				})),
			);
		},

		/** The ids of every monitor of each kind attached to a page, for pre-filling its edit form. */
		async getAttachedIds(statusPageId: string): Promise<StatusPageAttachedIds> {
			let where = { status_page_id: statusPageId };
			let [monitors, dnsMonitors, tcpMonitors, flows, cronJobs] = await Promise.all([
				this.db.findMany(statusPageMonitors, { where }),
				this.db.findMany(statusPageDnsMonitors, { where }),
				this.db.findMany(statusPageTcpMonitors, { where }),
				this.db.findMany(statusPageFlowMonitors, { where }),
				this.db.findMany(statusPageCronJobs, { where }),
			]);

			return {
				monitorIds: monitors.map((row) => row.monitor_id),
				dnsMonitorIds: dnsMonitors.map((row) => row.dns_monitor_id),
				tcpMonitorIds: tcpMonitors.map((row) => row.tcp_monitor_id),
				flowMonitorIds: flows.map((row) => row.flow_monitor_id),
				cronJobIds: cronJobs.map((row) => row.cron_job_monitor_id),
			};
		},

		/** Ordered join rows for the public page: which monitors of each kind to show, as curated. */
		async listAttachments(statusPageId: string): Promise<StatusPageAttachments> {
			let where = { status_page_id: statusPageId };
			let [monitors, dnsMonitors, tcpMonitors, flows, cronJobs] = await Promise.all([
				this.db.findMany(statusPageMonitors, { where, orderBy: ["order", "asc"] }),
				this.db.findMany(statusPageDnsMonitors, { where, orderBy: ["order", "asc"] }),
				this.db.findMany(statusPageTcpMonitors, { where, orderBy: ["order", "asc"] }),
				this.db.findMany(statusPageFlowMonitors, { where, orderBy: ["order", "asc"] }),
				this.db.findMany(statusPageCronJobs, { where, orderBy: ["order", "asc"] }),
			]);

			return { monitors, dnsMonitors, tcpMonitors, flowMonitors: flows, cronJobs };
		},

		/**
		 * A team's flow monitors as the public page may know them, keyed by id at the call site.
		 * The explicit projection keeps the credentialed `source` off a path that renders to the
		 * world: a leak would have to be written into this `SELECT`.
		 */
		async listPublicFlowMonitors(teamId: string): Promise<PublicFlowMonitor[]> {
			let result = await this.db.exec(
				`SELECT id, name, last_status FROM ${getTableName(flowMonitors)} WHERE team_id = ?`,
				[teamId],
			);

			return (result.rows ?? []) as unknown as PublicFlowMonitor[];
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},

		/**
		 * Removes every row attaching monitors to the page before the page itself goes, so a
		 * deleted page leaves no attachment behind. Each statement stands on its own, which
		 * keeps the cascade safe on D1, where a failed write rolls nothing back.
		 */
		async beforeDelete(page, ctx) {
			let where = { status_page_id: page.id };
			await ctx.db.deleteMany(statusPageMonitors, { where });
			await ctx.db.deleteMany(statusPageDnsMonitors, { where });
			await ctx.db.deleteMany(statusPageTcpMonitors, { where });
			await ctx.db.deleteMany(statusPageFlowMonitors, { where });
			await ctx.db.deleteMany(statusPageCronJobs, { where });
		},
	},
});

/** A status page, as reads return it. */
export type StatusPage = ModelRow<typeof StatusPages>;

export default StatusPages;
