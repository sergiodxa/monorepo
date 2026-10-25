/**
 * The email one alert delivery produces, addressed to the mailbox the alert names: a
 * translated subject and a body that reports the transition as labelled field lines. Alerts
 * carry no reader language, so the copy is in the app's fallback until an alert records one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailInput, EmailPropsOutput, EmailTableRow } from "@sdxc/mail";
import type { Handle } from "remix/component";

import { formatDateTime } from "@sdxc/dates";
import { createEmail, Email } from "@sdxc/mail";

import type { DnsFinding, SelectAlertEvent } from "~/database/schema";

import emails from "~/app/emails";
import { hasRecordSetEdit } from "~/app/services/dns/findings";

/** What every member of the template reads: the transition, the reader's locale and `t`. */
type Alert = EmailInput<EmailPropsOutput<typeof emails.alert>>;

/**
 * Locale key holding the shouty word a transition is announced with, written out per
 * event type so every key an email can ask for is greppable in the locale files. Total
 * over the column's plain string type, so an unrecognized value still names a state.
 */
function statusKey(eventType: SelectAlertEvent["event_type"]): string {
	if (eventType === "up") return "emails.alert.status.up";
	if (eventType === "degraded") return "emails.alert.status.degraded";
	return "emails.alert.status.down";
}

/**
 * Locale key holding the sentence one finding is reported with, written out per outcome
 * for the same reason {@link statusKey} is. Each key is a whole sentence, since the three
 * outcomes are distinct claims a translator states in their own language's word order.
 */
function findingKey(kind: DnsFinding["kind"]): string {
	if (kind === "missing") return "emails.alert.values.dnsFinding.missing";
	if (kind === "changed") return "emails.alert.values.dnsFinding.changed";
	return "emails.alert.values.dnsFinding.new";
}

/** One row of the transition report, both sides already translated. */
type AlertField = EmailTableRow;

/**
 * One of the email's instants, in the reader's language, with the zone spelled out.
 * The recipient is an alert's configured address, which carries no timezone of its own,
 * so the zone must be explicit or the reader assumes local time.
 *
 * @param date - Instant to report.
 * @param locale - Language the surrounding copy is in.
 * @returns The formatted date and time, with the zone spelled out.
 */
function alertDateTime(date: Date, locale: string): string {
	return `${formatDateTime(date, { locale, timeZone: "UTC" })} UTC`;
}

/**
 * The same, for the instants a snapshot carries as ISO strings, falling back to the
 * caller's word for an instant that was never recorded.
 *
 * @param iso - Instant as the snapshot stored it, or `null` when there isn't one.
 * @param locale - Language the surrounding copy is in.
 * @param fallback - Already-translated text to report in place of a missing instant.
 * @returns The formatted date and time, or the fallback.
 */
function snapshotDateTime(iso: string | null, locale: string, fallback: string): string {
	return iso === null ? fallback : alertDateTime(new Date(iso), locale);
}

namespace Lines {
	/** Props accepted by {@link Lines}. */
	export interface Props {
		/** Already-translated lines, in reading order. */
		lines: string[];
	}
}

/**
 * Several lines inside one table cell, separated by explicit breaks. `<br>` is the one
 * break every mail client honours inside a cell, and the only inline element the
 * plain-text derivation turns into a newline, so the text part matches the HTML one.
 *
 * @example <Lines lines={["No longer resolving: example.com MX 10 mx.example.com"]} />
 */
function Lines(handle: Handle<Lines.Props>) {
	return () => (
		<span>
			{handle.props.lines.map((line, index) => (
				<span key={line}>
					{index > 0 ? <br /> : null}
					{line}
				</span>
			))}
		</span>
	);
}

export default createEmail(emails.alert, {
	/**
	 * Names the monitor and its new state, behind the team's own prefix when one is
	 * configured; the prefix is the team's copy, so it is used verbatim.
	 */
	subject: (alert) => {
		let subject = alert.t("emails.alert.subject", {
			monitor: alert.monitorName,
			status: statusWord(alert),
		});
		return alert.subjectPrefix ? `${alert.subjectPrefix} ${subject}` : subject;
	},
	/** Headline, fields table, dashboard link, and incident totals when present. */
	body: (handle) => () => {
		let { t, locale, monitorName, dashboardUrl, incident } = handle.props;
		let status = statusWord(handle.props);
		let headline = t("emails.alert.heading", { monitor: monitorName, status });

		return (
			<Email.Layout
				lang={locale}
				title={headline}
				preview={t("emails.alert.preview", { monitor: monitorName, status })}
			>
				<Email.Heading>{headline}</Email.Heading>
				<Email.Table rows={fields(handle.props)} />
				{notes(handle.props).map((note) => (
					<Email.Text key={note} muted>
						{note}
					</Email.Text>
				))}
				<Email.Button href={dashboardUrl}>{t("emails.alert.action")}</Email.Button>
				{incident ? (
					<Email.Text muted>
						{t("emails.alert.incidentCooldown", {
							sent: incident.sent,
							suppressed: incident.suppressed,
						})}
					</Email.Text>
				) : null}
				<Email.Footer>{t("emails.alert.footer")}</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		subjectPrefix: "",
		monitorName: "Homepage",
		monitorType: "http",
		eventType: "down",
		snapshot: {
			type: "http",
			responseStatus: 500,
			responseTimeMs: 1200,
			expectedStatus: 200,
			url: "https://example.com",
		},
		dashboardUrl: "https://uptime.sergiodxa.com/app",
		occurredAt: Date.UTC(2026, 7, 1, 10),
		incident: null,
	}),
});

/**
 * Sentences the reported fields need but cannot carry: an edited value in a record set
 * reports as one record gone plus one new one, which reads as a bug unless explained. A
 * newly seen record starts disabled, awaiting the reader's action.
 */
function notes({ t, snapshot }: Alert): string[] {
	if (snapshot.type !== "dns") return [];

	let notes: string[] = [];
	if (hasRecordSetEdit(snapshot.findings)) notes.push(t("emails.alert.dns.recordSetEditNote"));
	if (snapshot.recordsNew > 0) notes.push(t("emails.alert.dns.newRecordsNote"));
	return notes;
}

/** The word this transition is announced with, shared by the subject and the body. */
function statusWord({ t, eventType }: Alert): string {
	return t(statusKey(eventType));
}

/** Every reported line: what changed, then the check's own detail, then when. */
function fields(alert: Alert): AlertField[] {
	let { t, locale, monitorName, monitorType, occurredAt } = alert;

	return [
		{
			label: t("emails.alert.fields.monitor"),
			value: t("emails.alert.values.monitor", { name: monitorName, type: monitorType }),
		},
		{ label: t("emails.alert.fields.status"), value: statusWord(alert) },
		...snapshotFields(alert),
		{ label: t("emails.alert.fields.time"), value: alertDateTime(occurredAt, locale) },
	];
}

/**
 * The lines specific to the kind of check that ran. Every branch is exhaustive over
 * the snapshot union, guaranteeing a compile error for any monitor type added without
 * its own case here.
 */
function snapshotFields({ t, locale, snapshot }: Alert): AlertField[] {
	let none = t("emails.alert.values.none");

	switch (snapshot.type) {
		case "http":
			return [
				{ label: t("emails.alert.fields.url"), value: snapshot.url },
				{
					label: t("emails.alert.fields.responseStatus"),
					value: t("emails.alert.values.responseStatus", {
						actual: snapshot.responseStatus,
						expected: snapshot.expectedStatus,
					}),
				},
				{
					label: t("emails.alert.fields.responseTime"),
					value: t("emails.alert.values.milliseconds", { value: snapshot.responseTimeMs }),
				},
			];

		case "dns": {
			let rows: AlertField[] = [
				{ label: t("emails.alert.fields.domain"), value: snapshot.domain },
				{ label: t("emails.alert.fields.status"), value: snapshot.status },
				{
					label: t("emails.alert.fields.records"),
					value: t("emails.alert.values.dnsRecordCounts", {
						missing: snapshot.recordsMissing,
						changed: snapshot.recordsChanged,
						new: snapshot.recordsNew,
					}),
				},
			];

			let lines = snapshot.findings.map((finding) =>
				t(findingKey(finding.kind), {
					name: finding.name,
					type: finding.recordType,
					value: finding.value,
				}),
			);

			/**
			 * The counters are the totals; the findings are a capped sample of the same
			 * buckets, so their difference is the count still to report as more findings.
			 */
			let hidden =
				snapshot.recordsMissing +
				snapshot.recordsChanged +
				snapshot.recordsNew -
				snapshot.findings.length;
			if (hidden > 0) lines.push(t("emails.alert.values.dnsMoreFindings", { count: hidden }));

			/**
			 * One row holds every finding, since the table keys rows by label and two
			 * findings of the same kind would share one. Reading them as a block keeps the
			 * two halves of an edited record set together.
			 */
			if (lines.length > 0) {
				rows.push({ label: t("emails.alert.fields.findings"), value: <Lines lines={lines} /> });
			}

			return rows;
		}

		case "tcp":
			return [
				{
					label: t("emails.alert.fields.endpoint"),
					value: t("emails.alert.values.endpoint", { host: snapshot.host, port: snapshot.port }),
				},
				{ label: t("emails.alert.fields.status"), value: snapshot.status },
				{
					label: t("emails.alert.fields.responseTime"),
					value:
						snapshot.responseTimeMs === null
							? none
							: t("emails.alert.values.milliseconds", { value: snapshot.responseTimeMs }),
				},
			];

		case "cron":
			return [
				{
					label: t("emails.alert.fields.schedule"),
					value: t("emails.alert.values.schedule", {
						expression: snapshot.cronExpression,
						timezone: snapshot.timezone,
					}),
				},
				{ label: t("emails.alert.fields.status"), value: snapshot.status },
				{
					label: t("emails.alert.fields.lastPing"),
					value: snapshotDateTime(snapshot.lastPingAt, locale, t("emails.alert.values.never")),
				},
				{
					label: t("emails.alert.fields.nextExpected"),
					value: snapshotDateTime(snapshot.nextExpectedAt, locale, none),
				},
			];

		case "flow": {
			let rows: AlertField[] = [
				{ label: t("emails.alert.fields.status"), value: snapshot.status },
				{
					label: t("emails.alert.fields.tests"),
					value: t("emails.alert.values.flowTests", {
						passed: snapshot.testsPassed,
						total: snapshot.testsTotal,
					}),
				},
			];

			/**
			 * The assertion that broke, quoted as the run reported it — the
			 * incident itself, not a code to go and interpret. A recovery carries none.
			 */
			if (snapshot.failedTest !== null) {
				rows.push({
					label: t("emails.alert.fields.failedTest"),
					value:
						snapshot.failedAtLine === null
							? snapshot.failedTest
							: t("emails.alert.values.flowFailedTest", {
									title: snapshot.failedTest,
									line: snapshot.failedAtLine,
								}),
				});
			}

			if (snapshot.failureDetail !== null) {
				rows.push({
					label: t("emails.alert.fields.failureDetail"),
					value: snapshot.failureDetail,
				});
			}

			rows.push({
				label: t("emails.alert.fields.duration"),
				value:
					snapshot.durationMs === null
						? none
						: t("emails.alert.values.milliseconds", { value: snapshot.durationMs }),
			});

			return rows;
		}

		case "ssl":
			return [
				{ label: t("emails.alert.fields.hostname"), value: snapshot.hostname },
				{ label: t("emails.alert.fields.status"), value: snapshot.status },
				{
					label: t("emails.alert.fields.expiresAt"),
					value: snapshotDateTime(snapshot.expiresAt, locale, none),
				},
			];

		case "registration":
			return [
				{ label: t("emails.alert.fields.domain"), value: snapshot.domain },
				{ label: t("emails.alert.fields.status"), value: snapshot.status },
				{
					label: t("emails.alert.fields.expiresAt"),
					value: snapshotDateTime(snapshot.expiresAt, locale, none),
				},
				{ label: t("emails.alert.fields.registrar"), value: snapshot.registrar ?? none },
				{
					label: t("emails.alert.fields.eppStatuses"),
					value: snapshot.eppStatuses.length === 0 ? none : snapshot.eppStatuses.join(", "),
				},
			];
	}
}
