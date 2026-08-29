/**
 * Shared alert-dispatch pipeline used by every check path. For each qualifying event
 * it skips monitors under an active maintenance window, resolves the alerts that
 * apply, skips any repeat still inside its cooldown, delivers the rest, and records
 * every outcome to `alert_events`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Mailer, SentMessage } from "@pkg/mail";
import type { Result } from "@pkg/result";
import type { Database } from "remix/data-table";

import { isFailure, wrap } from "@pkg/result";

import type { DnsRecordDiff } from "~/app/data/dns-monitor-record";
import type { MonitorScopeType } from "~/app/lib/monitor-scope";
import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { SslStatus } from "~/app/services/ssl-info";
import type { TcpCheckResult, TcpCheckStatus } from "~/app/services/tcp-check";
import type {
	AlertEventSnapshot,
	CronJobStatus,
	DnsFinding,
	SelectAlert,
	SelectAlertEvent,
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectDnsMonitorRecord,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import MaintenanceWindow from "~/app/data/maintenance-window";
import { AlertEmail } from "~/app/emails/alert";
import { emailTranslator } from "~/app/emails/locale";
import { repeatCooldownMinutes } from "~/app/lib/alert-policy";
import { hasRecordSetEdit, sortDnsFindings } from "~/app/lib/dns-findings";
import { absoluteUrl } from "~/app/lib/origin";
import { apportionCostByTeam, recordCost } from "~/app/services/cost";
import { shouldAlertOnSslStatus } from "~/app/services/ssl-info";
import routes from "~/routes/web";

/**
 * Floor on the cooldown a *repeat* notification is spaced by, in minutes. It replaces
 * a former per-incident send cap (ADR-004) that silenced long outages by capping
 * their total; the total is now unbounded, and only the rate is floored.
 */
/**
 * The cooldown a repeat notification for `alert` is actually spaced by. The numbers
 * live in `~/app/lib/alert-policy`, which has no imports, so the alert form can quote
 * the floor without pulling `~/app/services/cost` or `cloudflare:workers` into its bundle.
 */
function repeatCooldown(alert: SelectAlert): number {
	return repeatCooldownMinutes(alert.cooldown_minutes);
}

/**
 * Builds an absolute dashboard link from a route's relative `href()` path. Kept as its own
 * name because every call site here is about a dashboard page; the origin it resolves against
 * is shared with every other email link (`~/app/lib/origin`).
 */
export function dashboardUrl(path: string): string {
	return absoluteUrl(path);
}

export type AlertEventType = SelectAlertEvent["event_type"];
/**
 * `"ssl"` names a virtual monitor type: SSL checks run against an HTTP monitor's own
 * row, so it resolves and suppresses like `"http"` while recording its own
 * `alert_events.monitor_type` for accurate history.
 */
export type AlertMonitorKind = MonitorScopeType | "ssl";

export interface DispatchAlertsParams {
	db: Database;
	/**
	 * Mailer the email strategy delivers through. Request paths pass `ctx.email`;
	 * background ones resolve the container's mailer, since they have no request.
	 */
	mailer: Mailer;
	teamId: string;
	monitorId: string;
	monitorType: AlertMonitorKind;
	monitorName: string;
	eventType: AlertEventType;
	snapshot: AlertEventSnapshot;
	dashboardUrl: string;
}

/**
 * Runs the full alert pipeline for one monitor status transition. The one place every
 * alerting path passes through, so team cost is recorded here (ADR-007 §5) before the
 * maintenance-window check can return early — the lookups before it cost too.
 */
export async function dispatchAlerts(params: DispatchAlertsParams): Promise<void> {
	apportionCostByTeam([params.teamId]);

	/**
	 * SSL collapses to `"http"` for both lookups below: a certificate check runs against an
	 * HTTP monitor's own row, so the windows that cover that monitor and the alerts that
	 * watch it are the same ones. It stays `"ssl"` everywhere it is recorded.
	 */
	let scopeMonitorType: MonitorScopeType =
		params.monitorType === "ssl" ? "http" : params.monitorType;

	let suppressed = await MaintenanceWindow.isSuppressing(params.db, {
		teamId: params.teamId,
		monitorId: params.monitorId,
		monitorType: scopeMonitorType,
	});
	if (suppressed) return;

	let candidates = await Alert.listForMonitor(
		params.db,
		params.teamId,
		scopeMonitorType,
		params.monitorId,
	);

	let applicable =
		params.eventType === "up" ? candidates.filter((alert) => alert.notify_on_recovery) : candidates;

	await Promise.allSettled(applicable.map((alert) => deliverOne(alert, params)));
}

/**
 * Every reason an alert is recorded without being delivered — by convention every
 * `alert_events.status` of `skipped_*`, which is also what lets the history view tone
 * and label them together as one group.
 */
type SuppressionReason = Extract<SelectAlertEvent["status"], `skipped_${string}`>;

/**
 * Why `alert` must not be delivered right now, or `null` to deliver it. The first
 * notification of an incident always goes out; a repeat waits out its cooldown and
 * repeats indefinitely; a recovery is edge-triggered and gated only by that cooldown.
 */
async function suppressionReason(
	alert: SelectAlert,
	params: DispatchAlertsParams,
): Promise<SuppressionReason | null> {
	if (params.eventType === "up") {
		let recentRecovery = await AlertEvent.isInCooldown(
			params.db,
			alert.id,
			params.monitorId,
			params.eventType,
			alert.cooldown_minutes,
		);
		return recentRecovery ? "skipped_cooldown" : null;
	}

	/** Bounded at 1: this only asks whether the incident has been notified at all yet. */
	let alreadyNotified = await AlertEvent.countSentSinceRecovery(
		params.db,
		alert.id,
		params.monitorId,
		params.eventType,
		1,
	);
	if (alreadyNotified === 0) return null;

	let inCooldown = await AlertEvent.isInCooldown(
		params.db,
		alert.id,
		params.monitorId,
		params.eventType,
		repeatCooldown(alert),
	);
	return inCooldown ? "skipped_cooldown" : null;
}

async function deliverOne(alert: SelectAlert, params: DispatchAlertsParams): Promise<void> {
	/** Every exit from here records one outcome for this alert, and only one. */
	function record(status: SelectAlertEvent["status"], errorMessage: string | null) {
		return AlertEvent.record(params.db, {
			alert_id: alert.id,
			monitor_id: params.monitorId,
			event_type: params.eventType,
			status,
			error_message: errorMessage,
			monitor_type: params.monitorType,
			monitor_name: params.monitorName,
			snapshot: params.snapshot,
		});
	}

	let suppressed = await suppressionReason(alert, params);
	if (suppressed) {
		await record(suppressed, null);
		return;
	}

	let message = buildMessage(params);

	/** Without this a throttled incident is indistinguishable from alerts having been dropped. */
	if (params.eventType === "up") {
		let summary = await AlertEvent.summarizeIncident(params.db, alert.id, params.monitorId);
		if (summary.suppressed > 0) {
			message.incident = summary;
			message.text += `\n\nNotifications for this incident: ${summary.sent} sent, ${summary.suppressed} held back by the alert's cooldown.`;
		}
	}

	let outcome = await deliver(alert, message, params);
	if (isFailure(outcome)) {
		await record("failed", outcome.error.message);
		return;
	}

	await record("sent", null);
}

/**
 * The notification as the channel-agnostic pipeline builds it. `subject` and `text`
 * go on the wire verbatim for the chat and webhook strategies; the email strategy
 * renders its own translated body and reads only {@link AlertMessage.incident} here.
 */
interface AlertMessage {
	subject: string;
	text: string;
	/** Incident totals to report, set only on a recovery that suppressed something. */
	incident?: AlertEmail.Incident;
}

function statusWord(eventType: AlertEventType): string {
	if (eventType === "up") return "RECOVERED";
	if (eventType === "degraded") return "DEGRADED";
	return "DOWN";
}

/**
 * How each finding is named in the plain-text body. `missing` reports what a sweep
 * observes — a record stopped resolving — since a sweep can't see what caused that.
 * Only email translates these words; webhook, Slack, and Discord readers have no locale.
 */
const DNS_FINDING_WORDS: Record<DnsFinding["kind"], string> = {
	missing: "no longer resolving",
	changed: "changed to",
	new: "newly seen",
};

/** See {@link hasRecordSetEdit} — said in words wherever the shape appears. */
const RECORD_SET_EDIT_NOTE =
	"Note: a record set holding several values has no per-record identity in DNS, so a value edited inside one is reported as one record no longer resolving plus one new record.";

/** Newly seen records are imported disabled, so the alert has to say what to do with them. */
const NEW_RECORDS_NOTE =
	"Newly seen records are not being watched yet. Open the dashboard to accept the ones you expected, or fix your DNS.";

function snapshotLines(snapshot: AlertEventSnapshot): string[] {
	switch (snapshot.type) {
		case "http":
			return [
				`URL: ${snapshot.url}`,
				`Response status: ${snapshot.responseStatus} (expected ${snapshot.expectedStatus})`,
				`Response time: ${snapshot.responseTimeMs}ms`,
			];
		case "dns": {
			let lines = [
				`Domain: ${snapshot.domain}`,
				`Status: ${snapshot.status}`,
				`Records: ${snapshot.recordsMissing} missing, ${snapshot.recordsChanged} changed, ${snapshot.recordsNew} newly seen`,
				...snapshot.findings.map(
					(finding) =>
						`- ${DNS_FINDING_WORDS[finding.kind]}: ${finding.name} ${finding.recordType} ${finding.value}`,
				),
			];

			/**
			 * The counters count every finding while `findings` holds only a capped sample
			 * of them, so this gap is exactly how many are hidden here.
			 */
			let hidden =
				snapshot.recordsMissing +
				snapshot.recordsChanged +
				snapshot.recordsNew -
				snapshot.findings.length;
			if (hidden > 0) lines.push(`- and ${hidden} more`);

			if (hasRecordSetEdit(snapshot.findings)) lines.push(RECORD_SET_EDIT_NOTE);
			if (snapshot.recordsNew > 0) lines.push(NEW_RECORDS_NOTE);

			return lines;
		}
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

function buildMessage(params: DispatchAlertsParams): AlertMessage {
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

/**
 * Runs one alert's configured strategy and reports the outcome as a `Result`, so the
 * caller records `sent` or `failed` by checking it. The three HTTP-based strategies
 * signal failure by throwing, so `wrap` turns that into the same `Result` shape.
 */
async function deliver(
	alert: SelectAlert,
	message: AlertMessage,
	params: DispatchAlertsParams,
): Promise<Result<unknown, Error>> {
	/**
	 * Each case reads its config into a local first: the discriminated union narrows
	 * the property there, but a closure passed to `wrap` would widen it back to the
	 * whole union.
	 */
	switch (alert.config.strategy) {
		case "email":
			return await deliverEmail(alert.config.config, message, params);
		case "webhook": {
			let config = alert.config.config;
			return await wrap(() => deliverWebhook(config, message, params));
		}
		case "slack": {
			let config = alert.config.config;
			return await wrap(() => deliverSlack(config, message));
		}
		case "discord": {
			let config = alert.config.config;
			return await wrap(() => deliverDiscord(config, message));
		}
	}
}

/**
 * Sends one alert email and awaits the outcome for the pipeline to record. Cost is
 * counted before the send since even a rejected send is billed, and email costs far
 * more than the check that triggered it; language falls back to the app default since an alert addresses a mailbox with no stored locale to read.
 */
async function deliverEmail(
	config: { to: string; subjectPrefix: string },
	message: AlertMessage,
	params: DispatchAlertsParams,
): Promise<Result<SentMessage, Error>> {
	recordCost("emailSent");

	let translation = await wrap(() => emailTranslator());
	if (isFailure(translation)) return translation;

	return await params.mailer.send(
		new AlertEmail({
			to: config.to,
			subjectPrefix: config.subjectPrefix,
			monitorName: params.monitorName,
			monitorType: params.monitorType,
			eventType: params.eventType,
			snapshot: params.snapshot,
			dashboardUrl: params.dashboardUrl,
			occurredAt: new Date(),
			incident: message.incident ?? null,
			locale: translation.data.locale,
			t: translation.data.t,
		}),
	);
}

async function deliverWebhook(
	config: { url: string; secret: string },
	message: AlertMessage,
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
	message: AlertMessage,
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

async function deliverDiscord(
	config: { webhookUrl: string },
	message: AlertMessage,
): Promise<void> {
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
 * Whether a TCP result warrants an alert: every non-`up` result does, and `up` only
 * on a genuine recovery. Exported so a sweep can reuse this exact policy to decide
 * whether a transition is worth enqueuing (ADR-008), and re-checking it in the consumer keeps a redelivered message harmless.
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
 * See {@link shouldNotifyTcpResult}; `healthy` is the cron-job-equivalent state, `late`
 * is the single opt-in transition gated by `alert_on_late`, and `missed` always
 * notifies. A recovery only fires when the failure it ends was itself notified, so no one gets a "recovered" email for an outage they were never told started.
 */
export function shouldNotifyCronJobResult(
	previousStatus: CronJobStatus | null,
	newStatus: CronJobStatus,
	monitor: Pick<SelectCronJobMonitor, "alert_on_late">,
): boolean {
	if (newStatus === "new") return false;
	if (newStatus === "late") return monitor.alert_on_late;
	if (newStatus !== "healthy") return true;
	if (!recovered(previousStatus, "healthy") || previousStatus === "new") return false;
	return previousStatus !== "late" || monitor.alert_on_late;
}

/**
 * Per-monitor-type policy on top of {@link dispatchAlerts}: alert on every non-healthy
 * result (cooldown bounds the repeat rate) and alert `up` only on a genuine recovery.
 * A `previousStatus` of `null` (never checked before) never counts as a recovery.
 */
export async function notifyHttpResult(
	db: Database,
	mailer: Mailer,
	monitor: SelectMonitor,
	previousStatus: "up" | "down" | "degraded" | "timeout" | null,
	result: { status: "up" | "down" | "degraded"; responseStatus: number; responseTimeMs: number },
): Promise<void> {
	let isRecovery = result.status === "up" && recovered(previousStatus, "up");
	if (result.status === "up" && !isRecovery) return;

	await dispatchAlerts({
		db,
		mailer,
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
 * How many findings one snapshot quotes. A customer's zone sets how many a sweep can
 * produce — one nameserver change can make every tracked record a finding at once —
 * and five is as many as a notification can list before it reads like a report; the counters beside the list still carry the true totals.
 */
const MAX_SNAPSHOT_FINDINGS = 5;

/**
 * What a domain sweep found, as the alert pipeline needs it. The counters total the
 * whole sweep while `findings` holds the same records before {@link notifyDnsResult}
 * caps the list, so the email can report how many findings the cap hides.
 */
export interface DnsAlertResult {
	status: DnsCheckStatus;
	recordsChanged: number;
	recordsMissing: number;
	recordsNew: number;
	findings: DnsFinding[];
}

/**
 * The alert's view of one check, from the diff that check produced at the exact
 * moment of transition — more precise than anything reconstructed later. `seen`,
 * `absent`, and `ok` records log the user's own decision playing out; only real changes become findings.
 */
export function dnsAlertResultFromDiff(
	status: DnsCheckStatus,
	diff: DnsRecordDiff,
): DnsAlertResult {
	let findings: DnsFinding[] = [
		...diff.missing.map((record) =>
			toFinding("missing", record.name, record.record_type, record.value),
		),
		...diff.changed.map((change) =>
			toFinding("changed", change.record.name, change.record.record_type, change.value),
		),
		...diff.created.map((record) =>
			toFinding("new", record.name, record.record_type, record.value),
		),
	];

	return {
		status,
		recordsMissing: diff.missing.length,
		recordsChanged: diff.changed.length,
		recordsNew: diff.created.length,
		findings: sortDnsFindings(findings),
	};
}

/**
 * The same view, rebuilt from the records themselves for the `notify` queue consumer,
 * which never received the original diff. It reports what's outstanding right now —
 * the only honest answer a redelivered message can give — and skips disabled records except newly discovered ones still awaiting a decision.
 */
export function dnsAlertResultFromRecords(
	status: DnsCheckStatus,
	records: readonly SelectDnsMonitorRecord[],
): DnsAlertResult {
	let findings: DnsFinding[] = [];

	for (let record of records) {
		if (record.status === "new") {
			findings.push(toFinding("new", record.name, record.record_type, record.value));
			continue;
		}

		if (!record.is_enabled) continue;
		if (record.status === "missing") {
			findings.push(toFinding("missing", record.name, record.record_type, record.value));
		} else if (record.status === "changed") {
			findings.push(toFinding("changed", record.name, record.record_type, record.value));
		}
	}

	return {
		status,
		recordsMissing: findings.filter((finding) => finding.kind === "missing").length,
		recordsChanged: findings.filter((finding) => finding.kind === "changed").length,
		recordsNew: findings.filter((finding) => finding.kind === "new").length,
		findings: sortDnsFindings(findings),
	};
}

/** One finding, from the column names a record row uses to the ones a snapshot uses. */
function toFinding(
	kind: DnsFinding["kind"],
	name: string,
	recordType: string,
	value: string,
): DnsFinding {
	return { kind, name, recordType, value };
}

/**
 * See {@link notifyHttpResult}; `ok` is the DNS-equivalent healthy state. `result`
 * carries the sweep's findings, naming which of a monitor's many tracked records
 * changed, built via {@link dnsAlertResultFromDiff} or {@link dnsAlertResultFromRecords} so the counters and findings always describe the same event.
 */
export async function notifyDnsResult(
	db: Database,
	mailer: Mailer,
	monitor: SelectDnsMonitor,
	previousStatus: DnsCheckStatus | null,
	result: DnsAlertResult,
): Promise<void> {
	if (!shouldNotifyDnsResult(previousStatus, result.status)) return;
	/** Only reachable with an `ok` status when the policy above found a recovery. */
	let isRecovery = result.status === "ok";

	await dispatchAlerts({
		db,
		mailer,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "dns",
		monitorName: monitor.name,
		eventType: isRecovery ? "up" : result.status === "error" ? "down" : "degraded",
		snapshot: {
			type: "dns",
			status: result.status,
			domain: monitor.domain,
			recordsChanged: result.recordsChanged,
			recordsMissing: result.recordsMissing,
			recordsNew: result.recordsNew,
			findings: result.findings.slice(0, MAX_SNAPSHOT_FINDINGS),
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.dnsMonitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}

/** See {@link notifyHttpResult}; `up` is the TCP-equivalent healthy state. */
export async function notifyTcpResult(
	db: Database,
	mailer: Mailer,
	monitor: SelectTcpMonitor,
	previousStatus: TcpCheckStatus | null,
	result: TcpCheckResult,
): Promise<void> {
	if (!shouldNotifyTcpResult(previousStatus, result.status)) return;
	/** Only reachable with an `up` status when the policy above found a recovery. */
	let isRecovery = result.status === "up";

	await dispatchAlerts({
		db,
		mailer,
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
	mailer: Mailer,
	monitor: SelectCronJobMonitor,
	previousStatus: CronJobStatus | null,
	newStatus: CronJobStatus,
): Promise<void> {
	if (!shouldNotifyCronJobResult(previousStatus, newStatus, monitor)) return;
	/** Only reachable with a `healthy` status when the policy above found a recovery. */
	let isRecovery = newStatus === "healthy";

	await dispatchAlerts({
		db,
		mailer,
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
 * Fires every day {@link shouldAlertOnSslStatus} says to, per `docs/ssl-monitoring.md`'s
 * repeated reminders around warning thresholds and on expiry, throttled only by cooldown
 * and never capped in total. An SSL "incident" is every reminder ever sent for that monitor, since SSL never dispatches an `up` event.
 */
export async function notifySslResult(
	db: Database,
	mailer: Mailer,
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
		mailer,
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
