/**
 * Shared alert-dispatch pipeline used by every check path (`CheckHttpJob`,
 * `CheckDnsJob`, `CheckTcpJob`, `CheckCronJobsJob`, and the cron-job ping endpoint) —
 * one module instead of one dispatch implementation duplicated per monitor type. For
 * every qualifying event it: skips entirely when an active, suppressing maintenance
 * window covers the monitor; otherwise resolves the applicable alerts
 * (monitor-specific + team-wide for HTTP, team-wide only for other monitor types —
 * see `app/data/alert.ts`), skips any alert still in cooldown, delivers the rest
 * (email/webhook/Slack/Discord), and records every outcome to `alert_events`.
 * Cooldown and recovery notifications, and a real HMAC-SHA256 signature on webhook
 * deliveries, are enforced uniformly for every monitor type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Resend } from "resend";

import type { MaintenanceMonitorKind } from "~/app/data/maintenance-window";
import type { DnsCheckResult, DnsCheckStatus } from "~/app/services/dns-check";
import type { SslStatus } from "~/app/services/ssl-info";
import type { TcpCheckResult, TcpCheckStatus } from "~/app/services/tcp-check";
import type {
	AlertEventSnapshot,
	CronJobStatus,
	SelectAlert,
	SelectAlertEvent,
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import MaintenanceWindow from "~/app/data/maintenance-window";
import { shouldAlertOnSslStatus } from "~/app/services/ssl-info";
import routes from "~/routes/web";

const EMAIL_FROM = "Uptime <no-reply@uptime.sergiodxa.com>";
const EMAIL_REPLY_TO = "hello@sergiodxa.com";

/**
 * Production origin for links inside alert messages. Background jobs have no request
 * to derive an origin from, so this is a fixed constant — it'll need to move to this
 * app's own custom domain at the Phase 10 cutover.
 */
const DASHBOARD_ORIGIN = "https://uptime.sergiodxa.com";

/** Builds an absolute dashboard link from a route's relative `href()` path. */
export function dashboardUrl(path: string): string {
	return `${DASHBOARD_ORIGIN}${path}`;
}

export type AlertEventType = SelectAlertEvent["event_type"];
/**
 * `"ssl"` isn't a real monitor table — SSL checks run against an HTTP monitor's own
 * row — so it's resolved and suppressed exactly like `"http"` (same monitor id, same
 * maintenance windows) but recorded as its own `alert_events.monitor_type` for
 * accurate history.
 */
export type AlertMonitorKind = MaintenanceMonitorKind | "ssl";

export interface DispatchAlertsParams {
	db: Database;
	resend: Resend;
	teamId: string;
	monitorId: string;
	monitorType: AlertMonitorKind;
	monitorName: string;
	eventType: AlertEventType;
	snapshot: AlertEventSnapshot;
	dashboardUrl: string;
}

/** Runs the full alert pipeline for one monitor status transition. */
export async function dispatchAlerts(params: DispatchAlertsParams): Promise<void> {
	let isHttpMonitor = params.monitorType === "http" || params.monitorType === "ssl";
	let maintenanceMonitorType: MaintenanceMonitorKind =
		params.monitorType === "http" || params.monitorType === "ssl" ? "http" : params.monitorType;

	let suppressed = await MaintenanceWindow.isSuppressing(params.db, {
		teamId: params.teamId,
		monitorId: params.monitorId,
		monitorType: maintenanceMonitorType,
	});
	if (suppressed) return;

	let candidates = isHttpMonitor
		? await Alert.listForHttpMonitor(params.db, params.teamId, params.monitorId)
		: await Alert.listTeamWide(params.db, params.teamId);

	let applicable =
		params.eventType === "up" ? candidates.filter((alert) => alert.notify_on_recovery) : candidates;

	await Promise.allSettled(applicable.map((alert) => deliverOne(alert, params)));
}

async function deliverOne(alert: SelectAlert, params: DispatchAlertsParams): Promise<void> {
	if (
		await AlertEvent.isInCooldown(
			params.db,
			alert.id,
			params.monitorId,
			params.eventType,
			alert.cooldown_minutes,
		)
	) {
		await AlertEvent.record(params.db, {
			alert_id: alert.id,
			monitor_id: params.monitorId,
			event_type: params.eventType,
			status: "skipped_cooldown",
			error_message: null,
			monitor_type: params.monitorType,
			monitor_name: params.monitorName,
			snapshot: params.snapshot,
		});
		return;
	}

	let message = buildMessage(params);

	try {
		await deliver(alert, message, params);
		await AlertEvent.record(params.db, {
			alert_id: alert.id,
			monitor_id: params.monitorId,
			event_type: params.eventType,
			status: "sent",
			error_message: null,
			monitor_type: params.monitorType,
			monitor_name: params.monitorName,
			snapshot: params.snapshot,
		});
	} catch (error) {
		await AlertEvent.record(params.db, {
			alert_id: alert.id,
			monitor_id: params.monitorId,
			event_type: params.eventType,
			status: "failed",
			error_message: error instanceof Error ? error.message : String(error),
			monitor_type: params.monitorType,
			monitor_name: params.monitorName,
			snapshot: params.snapshot,
		});
	}
}

interface Message {
	subject: string;
	text: string;
}

function statusWord(eventType: AlertEventType): string {
	if (eventType === "up") return "RECOVERED";
	if (eventType === "degraded") return "DEGRADED";
	return "DOWN";
}

function snapshotLines(snapshot: AlertEventSnapshot): string[] {
	switch (snapshot.type) {
		case "http":
			return [
				`URL: ${snapshot.url}`,
				`Response status: ${snapshot.responseStatus} (expected ${snapshot.expectedStatus})`,
				`Response time: ${snapshot.responseTimeMs}ms`,
			];
		case "dns":
			return [
				`Domain: ${snapshot.domain} (${snapshot.recordType})`,
				`Status: ${snapshot.status}`,
				`Resolved value: ${snapshot.resolvedValue ?? "—"}`,
			];
		case "tcp":
			return [
				`Endpoint: ${snapshot.host}:${snapshot.port}`,
				`Status: ${snapshot.status}`,
				`Response time: ${snapshot.responseTimeMs === null ? "—" : `${snapshot.responseTimeMs}ms`}`,
			];
		case "cron":
			return [
				`Schedule: ${snapshot.cronExpression} (${snapshot.timezone})`,
				`Status: ${snapshot.status}`,
				`Last ping: ${snapshot.lastPingAt ?? "never"}`,
				`Next expected: ${snapshot.nextExpectedAt ?? "—"}`,
			];
		case "ssl":
			return [
				`Hostname: ${snapshot.hostname}`,
				`Status: ${snapshot.status}`,
				`Expires at: ${snapshot.expiresAt ?? "—"}`,
			];
	}
}

function buildMessage(params: DispatchAlertsParams): Message {
	let word = statusWord(params.eventType);
	let subject = `[Uptime Alert] ${params.monitorName} is ${word}`;
	let lines = [
		`Monitor: ${params.monitorName} (${params.monitorType})`,
		`Status: ${word}`,
		...snapshotLines(params.snapshot),
		`Time: ${new Date().toISOString()}`,
		`Dashboard: ${params.dashboardUrl}`,
	];
	return { subject, text: lines.join("\n") };
}

async function deliver(
	alert: SelectAlert,
	message: Message,
	params: DispatchAlertsParams,
): Promise<void> {
	switch (alert.config.strategy) {
		case "email":
			await deliverEmail(alert.config.config, message, params.resend);
			return;
		case "webhook":
			await deliverWebhook(alert.config.config, message, params);
			return;
		case "slack":
			await deliverSlack(alert.config.config, message);
			return;
		case "discord":
			await deliverDiscord(alert.config.config, message);
			return;
	}
}

async function deliverEmail(
	config: { to: string; subjectPrefix: string },
	message: Message,
	resend: Resend,
): Promise<void> {
	let subject = config.subjectPrefix
		? `${config.subjectPrefix} ${message.subject}`
		: message.subject;
	let result = await resend.emails.send({
		from: EMAIL_FROM,
		replyTo: EMAIL_REPLY_TO,
		to: config.to,
		subject,
		text: message.text,
	});
	if (result.error) throw new Error(result.error.message);
}

async function deliverWebhook(
	config: { url: string; secret: string },
	message: Message,
	params: DispatchAlertsParams,
): Promise<void> {
	let body = JSON.stringify({
		monitorId: params.monitorId,
		monitorType: params.monitorType,
		monitorName: params.monitorName,
		eventType: params.eventType,
		snapshot: params.snapshot,
		message: message.text,
		timestamp: new Date().toISOString(),
	});

	let headers = new Headers({ "Content-Type": "application/json" });
	if (config.secret)
		headers.set("Webhook-Signature", `sha256=${await hmacSha256Hex(config.secret, body)}`);

	let response = await fetch(config.url, { method: "POST", headers, body });
	if (!response.ok) throw new Error(`Webhook failed with status ${response.status}`);
}

async function deliverSlack(
	config: { webhookUrl: string; channel?: string },
	message: Message,
): Promise<void> {
	let body: { text: string; channel?: string } = { text: `*${message.subject}*\n${message.text}` };
	if (config.channel) body.channel = config.channel;

	let response = await fetch(config.webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error(`Slack webhook failed with status ${response.status}`);
}

async function deliverDiscord(config: { webhookUrl: string }, message: Message): Promise<void> {
	let response = await fetch(config.webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content: `**${message.subject}**\n${message.text}` }),
	});
	if (!response.ok) throw new Error(`Discord webhook failed with status ${response.status}`);
}

/** Signs `payload` with HMAC-SHA256 using `secret`, returning a lowercase hex digest. */
async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	let signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Whether a monitor moving to its healthy state counts as a recovery. A
 * `previousStatus` of `null` (never checked before) never does.
 */
function recovered<Status extends string>(previousStatus: Status | null, healthy: Status): boolean {
	return previousStatus !== null && previousStatus !== healthy;
}

/**
 * Whether a TCP result warrants an alert at all: every non-`up` result does, and an
 * `up` one only when it's a genuine recovery.
 *
 * Exported so a sweep can decide whether a transition is worth enqueuing a `notify`
 * message for (ADR-008) using the exact same policy {@link notifyTcpResult} applies —
 * the sweep never has to duplicate the rule, and re-checking it in the consumer keeps a
 * redelivered message harmless.
 */
export function shouldNotifyTcpResult(
	previousStatus: TcpCheckStatus | null,
	status: TcpCheckStatus,
): boolean {
	return status !== "up" || recovered(previousStatus, "up");
}

/** See {@link shouldNotifyTcpResult}; `ok` is the DNS-equivalent healthy state. */
export function shouldNotifyDnsResult(
	previousStatus: DnsCheckStatus | null,
	status: DnsCheckStatus,
): boolean {
	return status !== "ok" || recovered(previousStatus, "ok");
}

/**
 * See {@link shouldNotifyTcpResult}; `healthy` is the cron-job-equivalent state, and
 * neither a monitor moving to `new` nor one recovering from `new` is alert-worthy.
 *
 * `late` is the single opt-in transition: it's an early warning, so it only notifies when
 * the monitor has `alert_on_late` set. `missed` — the actual failure — always notifies, and
 * so does a recovery, including a recovery from a `late` the monitor was never told about:
 * the status transition still happens and is still what a later `missed` is reached from,
 * so what the flag withholds is the notification, never the state.
 */
export function shouldNotifyCronJobResult(
	previousStatus: CronJobStatus | null,
	newStatus: CronJobStatus,
	monitor: Pick<SelectCronJobMonitor, "alert_on_late">,
): boolean {
	if (newStatus === "new") return false;
	if (newStatus === "late") return monitor.alert_on_late;
	if (newStatus !== "healthy") return true;
	return recovered(previousStatus, "healthy") && previousStatus !== "new";
}

/**
 * Per-monitor-type policy on top of {@link dispatchAlerts}: alert on every non-healthy
 * result (cooldown is what prevents repeat spam), and only alert `up` on a genuine
 * recovery (the previous result was not healthy). A `previousStatus` of `null` (never
 * checked before) never counts as a recovery.
 */
export async function notifyHttpResult(
	db: Database,
	resend: Resend,
	monitor: SelectMonitor,
	previousStatus: "up" | "down" | "degraded" | "timeout" | null,
	result: { status: "up" | "down" | "degraded"; responseStatus: number; responseTimeMs: number },
): Promise<void> {
	let isRecovery = result.status === "up" && recovered(previousStatus, "up");
	if (result.status === "up" && !isRecovery) return;

	await dispatchAlerts({
		db,
		resend,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "http",
		monitorName: monitor.name,
		eventType: isRecovery ? "up" : result.status,
		snapshot: {
			type: "http",
			responseStatus: result.responseStatus,
			responseTimeMs: result.responseTimeMs,
			expectedStatus: monitor.expected_status,
			url: monitor.url,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.monitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}

/**
 * See {@link notifyHttpResult}; `ok` is the DNS-equivalent healthy state.
 *
 * `result` is narrowed to the fields an alert actually reads, so a caller that
 * reconstructs it from the monitor's cached columns (the `notify` queue consumer) isn't
 * forced to invent a response time nothing renders.
 */
export async function notifyDnsResult(
	db: Database,
	resend: Resend,
	monitor: SelectDnsMonitor,
	previousStatus: DnsCheckStatus | null,
	result: Pick<DnsCheckResult, "status" | "resolvedValue">,
): Promise<void> {
	if (!shouldNotifyDnsResult(previousStatus, result.status)) return;
	/** Only reachable with an `ok` status when the policy above found a recovery. */
	let isRecovery = result.status === "ok";

	await dispatchAlerts({
		db,
		resend,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "dns",
		monitorName: monitor.name,
		eventType: isRecovery ? "up" : result.status === "error" ? "down" : "degraded",
		snapshot: {
			type: "dns",
			status: result.status,
			resolvedValue: result.resolvedValue,
			domain: monitor.domain,
			recordType: monitor.record_type,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.dnsMonitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}

/** See {@link notifyHttpResult}; `up` is the TCP-equivalent healthy state. */
export async function notifyTcpResult(
	db: Database,
	resend: Resend,
	monitor: SelectTcpMonitor,
	previousStatus: TcpCheckStatus | null,
	result: TcpCheckResult,
): Promise<void> {
	if (!shouldNotifyTcpResult(previousStatus, result.status)) return;
	/** Only reachable with an `up` status when the policy above found a recovery. */
	let isRecovery = result.status === "up";

	await dispatchAlerts({
		db,
		resend,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "tcp",
		monitorName: monitor.name,
		eventType: isRecovery ? "up" : result.status === "down" ? "down" : "degraded",
		snapshot: {
			type: "tcp",
			status: result.status,
			responseTimeMs: result.responseTimeMs,
			host: monitor.host,
			port: monitor.port,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.tcpMonitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}

/**
 * See {@link notifyHttpResult}; `healthy` is the cron-job-equivalent state, `new` never
 * recovers, and a `late` transition is suppressed unless the monitor opted into it — see
 * {@link shouldNotifyCronJobResult} for why that lives in the predicate.
 */
export async function notifyCronJobResult(
	db: Database,
	resend: Resend,
	monitor: SelectCronJobMonitor,
	previousStatus: CronJobStatus | null,
	newStatus: CronJobStatus,
): Promise<void> {
	if (!shouldNotifyCronJobResult(previousStatus, newStatus, monitor)) return;
	/** Only reachable with a `healthy` status when the policy above found a recovery. */
	let isRecovery = newStatus === "healthy";

	await dispatchAlerts({
		db,
		resend,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "cron",
		monitorName: monitor.name,
		eventType: isRecovery ? "up" : newStatus === "missed" ? "down" : "degraded",
		snapshot: {
			type: "cron",
			status: newStatus,
			lastPingAt:
				monitor.last_ping_at === null ? null : new Date(monitor.last_ping_at).toISOString(),
			nextExpectedAt:
				monitor.next_expected_at === null ? null : new Date(monitor.next_expected_at).toISOString(),
			cronExpression: monitor.cron_expression,
			timezone: monitor.timezone,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.cronJobs.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}

/**
 * Unlike the other `notify*` helpers, this isn't edge-triggered — it fires every day
 * {@link shouldAlertOnSslStatus} says to, matching `docs/ssl-monitoring.md`'s "alerts
 * happen around key warning thresholds... and again on expiry" (repeated reminders,
 * not a one-time transition). Per-alert cooldown is what bounds the repetition.
 */
export async function notifySslResult(
	db: Database,
	resend: Resend,
	monitor: SelectMonitor,
	status: SslStatus,
	daysUntilExpiry: number | null,
): Promise<void> {
	if (!shouldAlertOnSslStatus(status, daysUntilExpiry)) return;

	let hostname: string;
	try {
		hostname = new URL(monitor.url).hostname;
	} catch {
		hostname = monitor.url;
	}

	await dispatchAlerts({
		db,
		resend,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "ssl",
		monitorName: monitor.name,
		eventType: status === "expired" ? "down" : "degraded",
		snapshot: {
			type: "ssl",
			status,
			expiresAt:
				monitor.ssl_expires_at === null ? null : new Date(monitor.ssl_expires_at).toISOString(),
			daysUntilExpiry,
			hostname,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.monitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}
