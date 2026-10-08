/**
 * The portable message an alert sends to Slack, Discord, PagerDuty and webhooks: a title
 * naming the transition, the snapshot as text, a severity, a dashboard link, and the
 * monitor's identity as structured data so a recovery resolves the incident it closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message, MessageData } from "@sdxc/messaging";

import type { AlertEventSnapshot, DnsFinding, SelectAlertEvent } from "~/database/schema";

import { hasRecordSetEdit } from "~/app/lib/dns-findings";

/** Which transition an alert reports. */
export type AlertEventType = SelectAlertEvent["event_type"];

/** What a recovery reports about the incident it ends, set only when something was held back. */
export interface IncidentSummary {
	sent: number;
	suppressed: number;
}

/** Everything about one transition the message is built from. */
export interface AlertMessageInput {
	monitorId: string;
	monitorType: string;
	monitorName: string;
	eventType: AlertEventType;
	snapshot: AlertEventSnapshot;
	dashboardUrl: string;
	incident: IncidentSummary | null;
	occurredAt: Date;
}

/**
 * The word each transition is announced with, uppercase so it reads as a state in a
 * channel full of prose.
 *
 * @param eventType - The transition.
 */
export function statusWord(eventType: AlertEventType): string {
	if (eventType === "up") return "RECOVERED";
	if (eventType === "degraded") return "DEGRADED";
	return "DOWN";
}

/**
 * How each finding is named in the plain-text body. `missing` reports what a sweep
 * observes — a record stopped resolving — since a sweep can't see what caused that.
 * Only email translates these words; chat and webhook readers have no locale.
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

/**
 * The snapshot as lines of text, one fact per line, which every channel but email
 * shows as the body of the alert.
 *
 * @param snapshot - What the check observed.
 */
export function snapshotLines(snapshot: AlertEventSnapshot): string[] {
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
		case "flow": {
			let lines = [
				`Status: ${snapshot.status}`,
				`Tests: ${snapshot.testsPassed} of ${snapshot.testsTotal} passed`,
			];

			/**
			 * The failing assertion is the incident, quoted here as the run reported it. A
			 * recovery carries none, so each line is written only when the run produced it.
			 */
			if (snapshot.failedTest !== null) {
				lines.push(
					snapshot.failedAtLine === null
						? `Failed test: ${snapshot.failedTest}`
						: `Failed test: ${snapshot.failedTest} (line ${snapshot.failedAtLine})`,
				);
			}
			if (snapshot.failureDetail !== null) lines.push(snapshot.failureDetail);

			lines.push(`Duration: ${snapshot.durationMs === null ? "—" : `${snapshot.durationMs}ms`}`);

			return lines;
		}
		case "ssl":
			return [
				`Hostname: ${snapshot.hostname}`,
				`Status: ${snapshot.status}`,
				`Expires at: ${snapshot.expiresAt ?? "—"}`,
			];
		case "registration":
			return [
				`Domain: ${snapshot.domain}`,
				`Status: ${snapshot.status}`,
				`Expires at: ${snapshot.expiresAt ?? "—"}`,
				`Registrar: ${snapshot.registrar ?? "—"}`,
				`Registry statuses: ${snapshot.eppStatuses.length === 0 ? "—" : snapshot.eppStatuses.join(", ")}`,
			];
	}
}

/**
 * The sentence a recovery closes with when the cooldown held notifications back, so a
 * throttled incident reads as throttled.
 *
 * @param incident - The incident's delivery totals.
 */
export function incidentNote(incident: IncidentSummary): string {
	return `Notifications for this incident: ${incident.sent} sent, ${incident.suppressed} held back by the alert's cooldown.`;
}

/**
 * The snapshot as JSON data, copying each DNS finding into a plain object so the whole
 * snapshot travels in a queue payload and a webhook body exactly as stored.
 */
function snapshotData(snapshot: AlertEventSnapshot): { [key: string]: MessageData } {
	if (snapshot.type !== "dns") return { ...snapshot };
	return {
		...snapshot,
		findings: snapshot.findings.map((finding) => ({
			kind: finding.kind,
			name: finding.name,
			recordType: finding.recordType,
			value: finding.value,
		})),
	};
}

/**
 * Builds the message one transition sends. `key` names the monitor, so PagerDuty resolves
 * the incident a recovery closes, and `data` carries what a webhook receiver reads.
 *
 * @param input - The transition, its snapshot and the incident totals for a recovery.
 * @returns The message, the same for every channel and every retry of its delivery.
 */
export function alertMessage(input: AlertMessageInput): Message {
	let recovered = input.eventType === "up";
	let text = snapshotLines(input.snapshot).join("\n");
	if (input.incident) text += `\n\n${incidentNote(input.incident)}`;

	let data: { [key: string]: MessageData } = {
		monitorId: input.monitorId,
		monitorType: input.monitorType,
		monitorName: input.monitorName,
		eventType: input.eventType,
		snapshot: snapshotData(input.snapshot),
		dashboardUrl: input.dashboardUrl,
	};
	if (input.incident) data["incident"] = { ...input.incident };

	return {
		title: `${input.monitorName} is ${statusWord(input.eventType)}`,
		text,
		severity: recovered ? "success" : input.eventType === "degraded" ? "warning" : "critical",
		fields: [{ label: "Type", value: input.monitorType, inline: true }],
		links: [{ label: "Open dashboard", url: input.dashboardUrl }],
		timestamp: input.occurredAt,
		key: `${input.monitorType}:${input.monitorId}`,
		state: recovered ? "resolved" : "open",
		data,
	};
}
