/**
 * Shared alert-dispatch pipeline used by every check path. For each qualifying event
 * it skips monitors under an active maintenance window, resolves the alerts that apply,
 * skips any repeat still inside its cooldown, sends email inline and queues every other
 * channel for the delivery job, recording each outcome to `alert_events`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Mailer, SentMessage } from "@sdxc/mail";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { isFailure, wrap } from "@sdxc/result";

import type { DnsRecordDiff } from "~/app/data/dns-monitor-record";
import type { MonitorScopeType } from "~/app/lib/monitor-scope";
import type { AlertEventType, IncidentSummary } from "~/app/services/alert-message";
import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { SslStatus } from "~/app/services/ssl-info";
import type { TcpCheckResult, TcpCheckStatus } from "~/app/services/tcp-check";
import type {
	AlertEventSnapshot,
	CronJobStatus,
	DnsFinding,
	FlowStatus,
	SelectAlert,
	SelectAlertEvent,
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectDnsMonitorRecord,
	SelectFlowMonitor,
	SelectFlowMonitorResult,
	SelectMonitor,
	SelectTcpMonitor,
	RegistrationStatus,
} from "~/database/schema";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import MaintenanceWindow from "~/app/data/maintenance-window";
import { AlertEmail } from "~/app/emails/alert";
import { emailTranslator } from "~/app/emails/locale";
import jobs from "~/app/jobs";
import { repeatCooldownMinutes } from "~/app/lib/alert-policy";
import { sortDnsFindings } from "~/app/lib/dns-findings";
import { absoluteUrl } from "~/app/lib/origin";
import { enqueue } from "~/app/lib/queue";
import { alertMessage } from "~/app/services/alert-message";
import { apportionCostByTeam, recordCost } from "~/app/services/cost";
import { registrationIsDown, shouldAlertOnRegistration } from "~/app/services/domain-registration";
import { classifyExpiry } from "~/app/services/expiry";
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

export type { AlertEventType };
/**
 * `"ssl"` and `"registration"` name virtual monitor types: an SSL check runs against an
 * HTTP monitor's own row and a registration lookup against a DNS monitor's, so each
 * resolves and suppresses like the monitor it belongs to while recording its own
 * `alert_events.monitor_type` for accurate history.
 */
export type AlertMonitorKind = MonitorScopeType | "ssl" | "registration";

/** The monitor type a kind resolves alerts and maintenance windows as. */
function scopeOf(kind: AlertMonitorKind): MonitorScopeType {
	if (kind === "ssl") return "http";
	if (kind === "registration") return "dns";
	return kind;
}

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
	 * A virtual kind collapses to the monitor it belongs to for both lookups below, so the
	 * windows that cover that monitor and the alerts that watch it are the same ones. It
	 * keeps its own kind everywhere it is recorded.
	 */
	let scopeMonitorType = scopeOf(params.monitorType);

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

/**
 * Settles one alert for one transition: a suppression is recorded as skipped, an email
 * is sent inline, and every other channel is recorded `pending` and queued for the
 * delivery job, which retries it and settles the row. Every exit records exactly one row.
 */
async function deliverOne(alert: SelectAlert, params: DispatchAlertsParams): Promise<void> {
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

	/** Without this a throttled incident is indistinguishable from alerts having been dropped. */
	let incident: IncidentSummary | null = null;
	if (params.eventType === "up") {
		let summary = await AlertEvent.summarizeIncident(params.db, alert.id, params.monitorId);
		if (summary.suppressed > 0) incident = summary;
	}

	let config = alert.config;
	if (config.strategy === "email") {
		let outcome = await deliverEmail(config.config, incident, params);
		if (isFailure(outcome)) await record("failed", outcome.error.message);
		else await record("sent", null);
		return;
	}

	let message = alertMessage({
		monitorId: params.monitorId,
		monitorType: params.monitorType,
		monitorName: params.monitorName,
		eventType: params.eventType,
		snapshot: params.snapshot,
		dashboardUrl: params.dashboardUrl,
		incident,
		occurredAt: new Date(),
	});

	let event = await record("pending", null);
	let queued = await wrap(() =>
		enqueue(jobs.deliverAlert, {
			alertId: alert.id,
			eventId: event.id,
			message: { ...message, timestamp: message.timestamp?.toISOString() },
		}),
	);
	if (isFailure(queued)) {
		await AlertEvent.markFailed(
			params.db,
			event.id,
			`Could not queue the delivery: ${queued.error.message}`,
		);
	}
}

/**
 * Sends one alert email and awaits the outcome for the pipeline to record. Cost is
 * counted before the send since even a rejected send is billed; language falls back to
 * the app default since an alert addresses a mailbox with no stored locale to read.
 */
async function deliverEmail(
	config: { to: string; subjectPrefix: string },
	incident: IncidentSummary | null,
	params: DispatchAlertsParams,
): Promise<Result<SentMessage, Error>> {
	recordCost("emailSent");

	let translation = wrap(() => emailTranslator());
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
			incident,
			locale: translation.data.locale,
			t: translation.data.t,
		}),
	);
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
 * See {@link shouldNotifyTcpResult}. A flow splits a broken flow from an unrunnable one
 * (ADR-027 §1): `down` is a failed assertion and always notifies, while `error` is this
 * app failing to find out — an unparsable spec, a host outside the team's verified
 * domains, a run past its cap — and pages nobody. Recovery therefore fires only out of
 * `down`, the one state anyone was told about.
 */
export function shouldNotifyFlowResult(
	previousStatus: FlowStatus | null,
	status: FlowStatus,
): boolean {
	if (status === "error") return false;
	if (status === "down") return true;
	return previousStatus === "down";
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
 * What a flow run concluded, as the alert pipeline needs it: the counters and the first
 * failing assertion, which is what the notification quotes verbatim (ADR-027 §8).
 */
export interface FlowAlertResult {
	status: FlowStatus;
	testsTotal: number;
	testsPassed: number;
	testsFailed: number;
	failedTest: string | null;
	failedAtLine: number | null;
	failureDetail: string | null;
	durationMs: number | null;
}

/**
 * The alert's view of one run, rebuilt from the result row the sweep persisted, for the
 * `notify` queue consumer, which receives only the transition. A monitor whose history
 * row is already gone still reports its transition, with the counters a run that left no
 * record can honestly claim.
 */
export function flowAlertResultFromResult(
	status: FlowStatus,
	result: SelectFlowMonitorResult | undefined,
): FlowAlertResult {
	if (result === undefined) {
		return {
			status,
			testsTotal: 0,
			testsPassed: 0,
			testsFailed: 0,
			failedTest: null,
			failedAtLine: null,
			failureDetail: null,
			durationMs: null,
		};
	}

	return {
		status,
		testsTotal: result.tests_total,
		testsPassed: result.tests_passed,
		testsFailed: result.tests_failed,
		failedTest: result.failed_test,
		failedAtLine: result.failed_at_line,
		failureDetail: result.failure_detail,
		durationMs: result.duration_ms,
	};
}

/**
 * See {@link notifyHttpResult}; `up` is the flow-equivalent healthy state and every
 * outage is a `down` event, since a flow either holds or it does not — see
 * {@link shouldNotifyFlowResult} for why an `error` reaches nobody.
 */
export async function notifyFlowResult(
	db: Database,
	mailer: Mailer,
	monitor: SelectFlowMonitor,
	previousStatus: FlowStatus | null,
	result: FlowAlertResult,
): Promise<void> {
	if (!shouldNotifyFlowResult(previousStatus, result.status)) return;
	/** Only reachable with an `up` status when the policy above found a recovery. */
	let isRecovery = result.status === "up";

	await dispatchAlerts({
		db,
		mailer,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "flow",
		monitorName: monitor.name,
		eventType: isRecovery ? "up" : "down",
		snapshot: {
			type: "flow",
			status: result.status,
			testsTotal: result.testsTotal,
			testsPassed: result.testsPassed,
			testsFailed: result.testsFailed,
			failedTest: result.failedTest,
			failedAtLine: result.failedAtLine,
			failureDetail: result.failureDetail,
			durationMs: result.durationMs,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.flowMonitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
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

/**
 * Sends the alert a registration lookup warrants (ADR-035), re-deciding it from the stored
 * row so a redelivered message answers the same. The EPP statuses count only while the last
 * lookup succeeded, matching the sweep, which has none to read from a failed one.
 */
export async function notifyRegistrationResult(
	db: Database,
	mailer: Mailer,
	monitor: SelectDnsMonitor,
	previous: RegistrationStatus | null,
	status: RegistrationStatus,
): Promise<void> {
	let { daysUntilExpiry } = classifyExpiry(
		monitor.registration_expires_at,
		monitor.registration_warning_days,
	);
	let eppStatuses =
		monitor.registration_error === null ? (monitor.registration_epp_statuses ?? []) : [];

	if (!shouldAlertOnRegistration(previous, status, daysUntilExpiry, eppStatuses)) return;

	await dispatchAlerts({
		db,
		mailer,
		teamId: monitor.team_id,
		monitorId: monitor.id,
		monitorType: "registration",
		monitorName: monitor.name,
		eventType: registrationIsDown(status, eppStatuses) ? "down" : "degraded",
		snapshot: {
			type: "registration",
			status,
			domain: monitor.domain,
			expiresAt:
				monitor.registration_expires_at === null
					? null
					: new Date(monitor.registration_expires_at).toISOString(),
			daysUntilExpiry,
			registrar: monitor.registrar,
			eppStatuses,
		},
		dashboardUrl: dashboardUrl(
			routes.app.team.dnsMonitors.show.href({ team: monitor.team_id, monitorId: monitor.id }),
		),
	});
}
