/**
 * The rows `sdxc run db seed` writes into the local database: the development login's user and
 * their team, a monitor of every kind with ninety days of history, an alert with its incidents,
 * a maintenance window and a status page, so every signed-in screen renders real-looking data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SeedContext } from "@sdxc/data-model/seed";

import { defineSeed } from "@sdxc/data-model/seed";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";

import { models as registry } from "~/app/models";
import { DEV_TEAM, DEV_USER } from "~/config/dev-user";

/** Milliseconds in a minute, hour and day, for placing seeded history in time. */
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Days of daily stats each monitor gets, matching the uptime bar's window. */
const HISTORY_DAYS = 90;

/** The bound models a seed step writes through. */
type SeedModels = SeedContext<typeof registry.entries>["models"];

/** A number in `[min, max)` that is the same on every run for the same `key`. */
function stable(key: number, min: number, max: number): number {
	let x = Math.sin(key * 12.9898) * 43_758.5453;
	return Math.floor(min + (x - Math.floor(x)) * (max - min));
}

/** The seeded team, which every other step writes into. */
async function devTeam(models: SeedModels) {
	let team = await models.teams.findByIdOrSlug(DEV_TEAM.slug);
	if (!team) throw new Error("Seed the team step first");
	return team;
}

/** The UTC `YYYY-MM-DD` key `daysAgo` days before `now`. */
function dayKey(now: number, daysAgo: number): string {
	return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/** A day's status from its failed checks: a few read as degraded, many as down. */
function dayStatus(failed: number): "up" | "degraded" | "down" {
	if (failed === 0) return "up";
	return failed > 20 ? "down" : "degraded";
}

/**
 * Writes `HISTORY_DAYS` of daily stats for one monitor. `incidentDays` lists the days (counted
 * back from today) that saw failures, so the uptime bar shows a few red and amber days.
 */
async function writeDailyStats(
	models: SeedModels,
	monitor: { id: string; type: "http" | "dns" | "tcp" | "cron" | "flow"; checksPerDay: number },
	incidentDays: number[],
	baseResponseMs: number | null,
) {
	let now = Date.now();
	for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
		let failed = incidentDays.includes(daysAgo) ? stable(daysAgo, 3, 40) : 0;
		let response = baseResponseMs === null ? null : baseResponseMs + stable(daysAgo, 0, 80);
		await models.monitorDailyStats.upsertDay({
			monitor_id: monitor.id,
			monitor_type: monitor.type,
			date: dayKey(now, daysAgo),
			total_checks: monitor.checksPerDay,
			successful_checks: monitor.checksPerDay - failed,
			failed_checks: failed,
			avg_response_time_ms: response,
			max_response_time_ms: response === null ? null : response * 3,
			status: dayStatus(failed),
		});
	}
}

export default defineSeed(registry, {
	/** The development login's team; its owner is made an admin member on create. */
	async team({ models }) {
		if (await models.teams.findByIdOrSlug(DEV_TEAM.slug)) return;
		unwrap(
			await models.teams.create({
				owner_id: DEV_USER.id,
				name: DEV_TEAM.name,
				slug: DEV_TEAM.slug,
				logo: null,
			}),
		);
	},

	/** Three HTTP monitors, one up, one slow and one down, each with daily history and results. */
	async httpMonitors({ models }) {
		let team = await devTeam(models);
		let now = Date.now();
		let specs = [
			{ name: "Marketing site", url: "https://acme.com", status: "up", ms: 182, incidents: [41] },
			{
				name: "API",
				url: "https://api.acme.com/health",
				status: "degraded",
				ms: 640,
				incidents: [3, 17, 18],
			},
			{
				name: "Checkout",
				url: "https://shop.acme.com/checkout",
				status: "down",
				ms: 0,
				incidents: [0, 9, 62],
			},
		] as const;
		for (let spec of specs) {
			let monitor = unwrap(
				await models.monitors.create({
					team_id: team.id,
					author_id: DEV_USER.id,
					name: spec.name,
					url: spec.url,
					method: "GET",
					expected_status: 200,
					interval_seconds: 60,
					enabled_at: now - HISTORY_DAYS * DAY_MS,
					next_due_at: now + MINUTE_MS,
					ssl_monitoring_enabled: true,
					ssl_status: "valid",
					ssl_issuer: "Let's Encrypt",
					ssl_expires_at: now + 54 * DAY_MS,
					last_status: spec.status,
					last_checked_at: now - 30_000,
					last_response_time_ms: spec.status === "down" ? null : spec.ms,
				}),
			);
			await writeDailyStats(
				models,
				{ id: monitor.id, type: "http", checksPerDay: 1440 },
				[...spec.incidents],
				spec.ms || 220,
			);
			for (let minute = 0; minute < 60; minute += 1) {
				let at = now - minute * MINUTE_MS;
				let down = spec.status === "down" && minute < 12;
				unwrap(
					await models.monitorResults.create({
						id: generateUUID(),
						monitor_id: monitor.id,
						completed_at: at,
						response_status: down ? 503 : 200,
						response_time_ms: down ? null : (spec.ms || 220) + stable(minute, 0, 120),
					}),
				);
			}
		}
	},

	/** A DNS monitor watching its records, with one record that changed. */
	async dnsMonitor({ models }) {
		let team = await devTeam(models);
		let now = Date.now();
		let monitor = unwrap(
			await models.dnsMonitors.create({
				team_id: team.id,
				name: "acme.com records",
				domain: "acme.com",
				interval_seconds: 3600,
				next_due_at: now + HOUR_MS,
				last_checked_at: now - 20 * MINUTE_MS,
				last_status: "changed",
				registration_status: "valid",
				registrar: "Cloudflare, Inc.",
				registration_expires_at: now + 210 * DAY_MS,
				registration_checked_at: now - DAY_MS,
			}),
		);
		let records = [
			{ name: "acme.com", record_type: "A", value: "104.21.4.10", status: "ok" },
			{ name: "acme.com", record_type: "AAAA", value: "2606:4700:3030::6815:40a", status: "ok" },
			{ name: "acme.com", record_type: "MX", value: "10 mx.acme.com", status: "ok" },
			{ name: "www.acme.com", record_type: "CNAME", value: "acme.com", status: "changed" },
			{
				name: "acme.com",
				record_type: "TXT",
				value: "v=spf1 include:_spf.acme.com ~all",
				status: "ok",
			},
		] as const;
		for (let record of records) {
			unwrap(
				await models.dnsMonitorRecords.create({
					id: generateUUID(),
					dns_monitor_id: monitor.id,
					...record,
					source: "resolver",
					first_seen_at: now - 80 * DAY_MS,
					last_seen_at: now - 20 * MINUTE_MS,
					last_checked_at: now - 20 * MINUTE_MS,
				}),
			);
		}
		for (let hour = 0; hour < 24; hour += 1) {
			unwrap(
				await models.dnsMonitorResults.create({
					id: generateUUID(),
					dns_monitor_id: monitor.id,
					status: hour === 0 ? "changed" : "ok",
					records_checked: records.length,
					records_changed: hour === 0 ? 1 : 0,
					records_missing: 0,
					records_new: 0,
					queries_failed: 0,
					error_message: null,
					response_time_ms: 24 + stable(hour, 0, 30),
					checked_at: now - hour * HOUR_MS - 20 * MINUTE_MS,
				}),
			);
		}
		await writeDailyStats(models, { id: monitor.id, type: "dns", checksPerDay: 24 }, [0], 31);
	},

	/** A TCP monitor on the database port, with a timeout last week. */
	async tcpMonitor({ models }) {
		let team = await devTeam(models);
		let now = Date.now();
		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: team.id,
				name: "Postgres primary",
				host: "db.acme.com",
				port: 5432,
				interval_seconds: 60,
				next_due_at: now + MINUTE_MS,
				last_checked_at: now - 40_000,
				last_status: "up",
				last_response_time_ms: 18,
			}),
		);
		for (let minute = 0; minute < 60; minute += 1) {
			unwrap(
				await models.tcpMonitorResults.create({
					id: generateUUID(),
					tcp_monitor_id: monitor.id,
					status: "up",
					response_time_ms: 14 + stable(minute, 0, 10),
					checked_at: now - minute * MINUTE_MS,
				}),
			);
		}
		await writeDailyStats(models, { id: monitor.id, type: "tcp", checksPerDay: 1440 }, [6], 17);
	},

	/** Two cron jobs, one healthy and one that missed its last run, with their pings. */
	async cronJobs({ models }) {
		let team = await devTeam(models);
		let now = Date.now();
		let jobs = [
			{
				name: "Nightly backup",
				cron: "0 3 * * *",
				status: "healthy",
				every: DAY_MS,
				incidents: [12],
			},
			{
				name: "Invoice sync",
				cron: "*/15 * * * *",
				status: "missed",
				every: 15 * MINUTE_MS,
				incidents: [0],
			},
		] as const;
		for (let job of jobs) {
			let lastPing = job.status === "missed" ? now - 50 * MINUTE_MS : now - 5 * HOUR_MS;
			let monitor = unwrap(
				await models.cronJobMonitors.create({
					team_id: team.id,
					name: job.name,
					cron_expression: job.cron,
					status: job.status,
					last_ping_at: lastPing,
					next_expected_at: lastPing + job.every,
					enabled_at: now - HISTORY_DAYS * DAY_MS,
				}),
			);
			for (let ping = 0; ping < 20; ping += 1) {
				unwrap(
					await models.cronJobPings.create({
						id: generateUUID(),
						cron_job_monitor_id: monitor.id,
						was_on_time: ping !== 3,
						source_ip: "203.0.113.24",
						user_agent: "curl/8.7.1",
					}),
				);
			}
			let perDay = Math.round(DAY_MS / job.every);
			await writeDailyStats(
				models,
				{ id: monitor.id, type: "cron", checksPerDay: perDay },
				[...job.incidents],
				null,
			);
		}
	},

	/** A flow monitor running a sign-in spec, with its recent runs. */
	async flowMonitor({ models }) {
		let team = await devTeam(models);
		let now = Date.now();
		let monitor = unwrap(
			await models.flowMonitors.create({
				team_id: team.id,
				name: "Sign-in flow",
				source: 'test "signs in" {\n\tthen {\n\t\texpect true\n\t}\n}',
				interval_seconds: 900,
				next_due_at: now + 15 * MINUTE_MS,
				last_checked_at: now - 6 * MINUTE_MS,
				last_status: "up",
			}),
		);
		for (let run = 0; run < 12; run += 1) {
			let failed = run === 4;
			unwrap(
				await models.flowMonitorResults.create({
					id: generateUUID(),
					flow_monitor_id: monitor.id,
					status: failed ? "down" : "up",
					tests_total: 1,
					tests_passed: failed ? 0 : 1,
					tests_failed: failed ? 1 : 0,
					requests_made: 3,
					failed_test: failed ? "signs in" : null,
					failed_at_line: failed ? 3 : null,
					failure_detail: failed ? "Expected status 200, got 502" : null,
					duration_ms: 1400 + stable(run, 0, 600),
					checked_at: now - run * 15 * MINUTE_MS - 6 * MINUTE_MS,
				}),
			);
		}
		await writeDailyStats(
			models,
			{ id: monitor.id, type: "flow", checksPerDay: 96 },
			[4, 33],
			1650,
		);
	},

	/** A team-wide email alert and the incidents it delivered. */
	async alerts({ models }) {
		let team = await devTeam(models);
		let now = Date.now();
		let alert = unwrap(
			await models.alerts.create({
				team_id: team.id,
				name: "On-call email",
				config: { strategy: "email", config: { to: DEV_USER.email, subjectPrefix: "[Acme]" } },
			}),
		);
		let checkout =
			(await models.monitors.inTeam(team.id).where({ name: "Checkout" }).first()) ?? null;
		let api = (await models.monitors.inTeam(team.id).where({ name: "API" }).first()) ?? null;
		let events = [
			{ monitor: checkout, type: "down", ago: 12 * MINUTE_MS },
			{ monitor: api, type: "degraded", ago: 3 * DAY_MS },
			{ monitor: api, type: "up", ago: 3 * DAY_MS - 40 * MINUTE_MS },
			{ monitor: checkout, type: "down", ago: 9 * DAY_MS },
			{ monitor: checkout, type: "up", ago: 9 * DAY_MS - 25 * MINUTE_MS },
		] as const;
		for (let event of events) {
			if (!event.monitor) continue;
			unwrap(
				await models.alertEvents.create({
					alert_id: alert.id,
					monitor_id: event.monitor.id,
					event_type: event.type,
					status: "sent",
					sent_at: now - event.ago,
					monitor_type: "http",
					monitor_name: event.monitor.name,
					snapshot: {
						type: "http",
						responseStatus: event.type === "down" ? 503 : 200,
						responseTimeMs: event.type === "degraded" ? 6200 : 210,
						expectedStatus: 200,
						url: event.monitor.url,
					},
				}),
			);
		}
	},

	/** A maintenance window starting tomorrow, shown on the status page. */
	async maintenance({ models }) {
		let team = await devTeam(models);
		let start = Date.now() + DAY_MS;
		unwrap(
			await models.maintenanceWindows.create({
				team_id: team.id,
				name: "Database upgrade",
				starts_at: start,
				ends_at: start + 2 * HOUR_MS,
			}),
		);
	},

	/** A public status page. */
	async statusPage({ models }) {
		let team = await devTeam(models);
		unwrap(
			await models.statusPages.create({
				team_id: team.id,
				name: "Acme status",
				slug: "acme",
				title: "Acme status",
				description: "Live status for Acme's site, API and checkout.",
			}),
		);
	},
});
