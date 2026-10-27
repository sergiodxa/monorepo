/**
 * Public camelCase shapes every MCP tool returns, matching the API serializers so a
 * model sees the same fields REST clients already know.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	SelectApiKey,
	SelectCronJobMonitor,
	SelectDnsMonitorRecord,
	SelectFlowMonitor,
	SelectInvite,
	SelectMonitor,
	SelectMonitorContentCheck,
	SelectTcpMonitor,
	SelectTeam,
	SelectTeamDomain,
} from "~/database/schema";

import { serializeAlertSafe, serializeAlertStrategyOnly } from "~/app/http/controllers/api/alerts";
import { serializeDnsMonitor } from "~/app/http/controllers/api/dns-monitors";
import { serializeMaintenanceWindow } from "~/app/http/controllers/api/maintenance";
import { serializeStatusPage } from "~/app/http/controllers/api/status-pages";
import { storedMonitorScope } from "~/app/services/monitor-scope";
import { encodeId, encodeMonitorId } from "~/app/services/typed-id";

export {
	serializeAlertSafe,
	serializeAlertStrategyOnly,
	serializeDnsMonitor,
	serializeMaintenanceWindow,
	serializeStatusPage,
};

/** Maps an HTTP monitor row to its public camelCase JSON shape. */
export function serializeMonitor(monitor: SelectMonitor) {
	return {
		id: encodeId("mon", monitor.id),
		name: monitor.name,
		url: monitor.url,
		method: monitor.method,
		expectedStatus: monitor.expected_status,
		intervalSeconds: monitor.interval_seconds,
		degradedAfterMs: monitor.degraded_after_ms,
		timeoutSeconds: monitor.timeout_seconds,
		locationHint: monitor.location_hint,
		enabledAt: monitor.enabled_at,
		sslMonitoringEnabled: monitor.ssl_monitoring_enabled,
		sslExpiryWarningDays: monitor.ssl_expiry_warning_days,
		sslExpiresAt: monitor.ssl_expires_at,
		sslIssuer: monitor.ssl_issuer,
		sslStatus: monitor.ssl_status,
		sslLastCheckedAt: monitor.ssl_last_checked_at,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/** Maps a content-check row to its public camelCase JSON shape. */
export function serializeContentCheck(check: SelectMonitorContentCheck) {
	return {
		id: encodeId("chk", check.id),
		monitorId: encodeId("mon", check.monitor_id),
		type: check.type,
		value: check.value,
		caseSensitive: check.case_sensitive,
		isEnabled: check.is_enabled,
		createdAt: check.created_at,
		updatedAt: check.updated_at,
	};
}

/** Maps a DNS monitor record row to its public camelCase JSON shape. */
export function serializeDnsMonitorRecord(record: SelectDnsMonitorRecord) {
	return {
		id: encodeId("dnsrec", record.id),
		dnsMonitorId: encodeId("dns", record.dns_monitor_id),
		name: record.name,
		recordType: record.record_type,
		value: record.value,
		source: record.source,
		isEnabled: record.is_enabled,
		status: record.status,
		firstSeenAt: record.first_seen_at,
		lastSeenAt: record.last_seen_at,
		lastCheckedAt: record.last_checked_at,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
	};
}

/** Maps a TCP monitor row to its public camelCase JSON shape. */
export function serializeTcpMonitor(monitor: SelectTcpMonitor) {
	return {
		id: encodeId("tcpm", monitor.id),
		name: monitor.name,
		host: monitor.host,
		port: monitor.port,
		timeoutMs: monitor.timeout_ms,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		lastResponseTimeMs: monitor.last_response_time_ms,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/**
 * Maps a flow monitor row to its public camelCase JSON shape. `source` is absent: a spec
 * holds credentials, and every read path omits it.
 */
export function serializeFlowMonitor(monitor: SelectFlowMonitor) {
	return {
		id: encodeId("flow", monitor.id),
		name: monitor.name,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/** Maps a cron-job monitor row to its public camelCase JSON shape. */
export function serializeCronJob(monitor: SelectCronJobMonitor) {
	return {
		id: encodeId("cron", monitor.id),
		name: monitor.name,
		description: monitor.description,
		cronExpression: monitor.cron_expression,
		gracePeriodSeconds: monitor.grace_period_seconds,
		timezone: monitor.timezone,
		status: monitor.status,
		alertOnLate: monitor.alert_on_late,
		lastPingAt: monitor.last_ping_at,
		nextExpectedAt: monitor.next_expected_at,
		enabledAt: monitor.enabled_at,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/** Maps a team row to its public camelCase JSON shape. */
export function serializeTeam(team: SelectTeam) {
	return {
		id: encodeId("team", team.id),
		name: team.name,
		slug: team.slug,
		logo: team.logo,
		ownerId: encodeId("usr", team.owner_id),
		createdAt: team.created_at,
		updatedAt: team.updated_at,
	};
}

/** Maps an invite row to its public camelCase JSON shape. */
export function serializeInvite(invite: SelectInvite) {
	return {
		id: encodeId("inv", invite.id),
		email: invite.email,
		senderId: encodeId("usr", invite.sender_id),
		teamId: encodeId("team", invite.team_id),
		acceptedAt: invite.accepted_at,
		createdAt: invite.created_at,
		updatedAt: invite.updated_at,
	};
}

/** Maps a team-domain row to its public camelCase JSON shape. */
export function serializeTeamDomain(domain: SelectTeamDomain) {
	return {
		id: encodeId("dom", domain.id),
		hostname: domain.hostname,
		verifiedAt: domain.verified_at,
		teamId: encodeId("team", domain.team_id),
		createdAt: domain.created_at,
		updatedAt: domain.updated_at,
	};
}

/** Maps a membership row to its public camelCase JSON shape. */
export function serializeMembership(membership: {
	id: string;
	subject_id: string;
	team_id: string;
	role: string;
	created_at: number;
	updated_at: number;
}) {
	return {
		id: encodeId("mem", membership.id),
		subjectId: encodeId("usr", membership.subject_id),
		teamId: encodeId("team", membership.team_id),
		role: membership.role,
		createdAt: membership.created_at,
		updatedAt: membership.updated_at,
	};
}

/** Maps an API-key row to its public JSON shape, omitting the key hash. */
export function serializeApiKey(apiKey: SelectApiKey) {
	return {
		id: encodeId("key", apiKey.id),
		name: apiKey.name,
		scopes: apiKey.scopes,
		createdAt: apiKey.created_at,
		lastUsedAt: apiKey.last_used_at,
		expiresAt: apiKey.expires_at,
		keyPrefix: apiKey.key_prefix,
	};
}

/** Maps an alert-event row to its public camelCase JSON shape. */
export function serializeAlertEvent(event: {
	id: string;
	alert_id: string;
	monitor_type: string | null;
	monitor_id: string;
	event_type: string;
	status: string;
	sent_at: number;
	error_message: string | null;
	created_at: number;
}) {
	return {
		id: encodeId("evt", event.id),
		alertId: encodeId("alt", event.alert_id),
		monitorId: encodeMonitorId(event.monitor_type, event.monitor_id),
		eventType: event.event_type,
		status: event.status,
		sentAt: event.sent_at,
		errorMessage: event.error_message,
		createdAt: event.created_at,
	};
}

/** Re-exports scope helper used when serializing scoped resources inline. */
export { storedMonitorScope };
