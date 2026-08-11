/**
 * The email one alert delivery produces: recipient, translated subject, and a body
 * that reports the transition as labelled field lines. Everything it renders comes
 * from the snapshot it was constructed with, so it holds no database handle and can
 * be exercised without one (ADR-030).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address, EmailTableRow } from "@pkg/mail";
import type { Handle, RemixElement } from "remix/ui";

import { formatDateTime } from "@pkg/dates";
import { Email } from "@pkg/mail";

import type { AlertEventSnapshot, DnsFinding, SelectAlertEvent } from "~/database/schema";

import { hasRecordSetEdit } from "~/app/lib/dns-findings";

/**
 * Locale key holding the shouty word a transition is announced with. Written out per
 * event type rather than interpolated into a key, so every key an email can ask for is
 * greppable in the locale files, and total rather than a lookup, because the column's
 * row type is a plain string and an unknown value still has to name a state.
 */
function statusKey(eventType: SelectAlertEvent["event_type"]): string {
	if (eventType === "up") return "emails.alert.status.up";
	if (eventType === "degraded") return "emails.alert.status.degraded";
	return "emails.alert.status.down";
}

/**
 * Locale key holding the sentence one finding is reported with, written out per outcome
 * for the same reason {@link statusKey} is: an interpolated key is a key no grep for the
 * locale files will find.
 *
 * Each key is a whole sentence rather than a word slotted into a shared template, because
 * the three outcomes are different claims — one record stopped resolving, one now answers
 * with a different value, one appeared and is not being watched — and a translator needs
 * to say each of them in its own language's word order.
 */
function findingKey(kind: DnsFinding["kind"]): string {
	if (kind === "missing") return "emails.alert.values.dnsFinding.missing";
	if (kind === "changed") return "emails.alert.values.dnsFinding.changed";
	return "emails.alert.values.dnsFinding.new";
}

/** One row of the transition report, both sides already translated. */
type AlertField = EmailTableRow;

/**
 * One of the email's instants, in the reader's language and in UTC.
 *
 * The zone is spelled out rather than guessed at: this address is a notification
 * target on a team, not necessarily a member with a profile, so there is no timezone
 * to render it in — and an unlabelled timestamp is one a reader will assume is local.
 *
 * @param date - Instant to report.
 * @param locale - Language the surrounding copy is in.
 * @returns The formatted date and time, with the zone spelled out.
 */
function alertDateTime(date: Date, locale: string): string {
	return `${formatDateTime(date, { locale, timeZone: "UTC" })} UTC`;
}

/**
 * The same, for the instants a snapshot carries as ISO strings rather than as dates,
 * falling back to the caller's word for an instant that was never recorded.
 *
 * @param iso - Instant as the snapshot stored it, or `null` when there isn't one.
 * @param locale - Language the surrounding copy is in.
 * @param fallback - Already-translated text to report in place of a missing instant.
 * @returns The formatted date and time, or the fallback.
 */
function snapshotDateTime(iso: string | null, locale: string, fallback: string): string {
	return iso === null ? fallback : alertDateTime(new Date(iso), locale);
}

export namespace Lines {
	/** Props accepted by {@link Lines}. */
	export interface Props {
		/** Already-translated lines, in reading order. */
		lines: string[];
	}
}

/**
 * Several lines inside one table cell, separated by explicit breaks.
 *
 * `<br>` rather than a list or a nested table because it is the one break every mail
 * client honours inside a cell, and because it is also the only inline element the
 * plain-text derivation turns into a newline — so the text part reads as the same lines
 * the HTML one shows.
 *
 * @example <Lines lines={["No longer resolving: example.com MX 10 mx.example.com"]} />
 */
export function Lines(handle: Handle<Lines.Props>) {
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

export namespace AlertEmail {
	/**
	 * What an incident cost in notifications, reported only on the recovery that ends
	 * it. Without it a throttled incident is indistinguishable from alerts being dropped.
	 */
	export interface Incident {
		/** Notifications actually delivered during the incident. */
		sent: number;
		/**
		 * Notifications the alert's cooldown held back. There is no longer a ceiling on how
		 * many an incident may send, so cooldown is the only thing this counts — the totals
		 * of an incident that carries `skipped_cap` events from before the ceiling was
		 * removed are reported the same way, since both were withheld to space out repeats.
		 */
		suppressed: number;
	}

	/** Everything the alert email needs, already resolved by the dispatch pipeline. */
	export interface Data {
		/** Mailbox this alert is configured to notify. */
		to: string;
		/** Free-form prefix the team put in front of every subject; empty when unset. */
		subjectPrefix: string;
		/** Name of the monitor whose status changed. */
		monitorName: string;
		/** Which kind of monitor it is, reported beside the name. */
		monitorType: NonNullable<SelectAlertEvent["monitor_type"]>;
		/** The transition being announced. */
		eventType: SelectAlertEvent["event_type"];
		/** Type-specific detail of the check that triggered it. */
		snapshot: AlertEventSnapshot;
		/** Absolute URL of the monitor's dashboard page. */
		dashboardUrl: string;
		/** When the transition was reported; passed in so a test can pin it. */
		occurredAt: Date;
		/** Incident totals to report, or `null` when there is nothing to report. */
		incident: Incident | null;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Notification that a monitor changed state, addressed to the mailbox the alert
 * names. Alerts are configured with an address rather than with an account, so the
 * language is the app's fallback until an alert records one of its own.
 *
 * @example await mailer.send(new AlertEmail({ ...transition, locale, t }));
 */
export class AlertEmail implements Email {
	/** The transition this email reports; nothing is loaded while rendering. */
	#alert: AlertEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param alert - The transition, its language, and the translator for it.
	 */
	constructor(alert: AlertEmail.Data) {
		this.#alert = alert;
	}

	/** The mailbox the alert is configured to notify. */
	get to(): Address {
		return { email: this.#alert.to };
	}

	/**
	 * Subject naming the monitor and its new state, behind the team's own prefix when
	 * one is configured — the prefix is the team's copy, so it is used verbatim.
	 */
	get subject(): string {
		let { t, subjectPrefix, monitorName } = this.#alert;
		let subject = t("emails.alert.subject", { monitor: monitorName, status: this.#status() });
		return subjectPrefix ? `${subjectPrefix} ${subject}` : subject;
	}

	/**
	 * Body tree the mailer renders into both parts: the headline, the reported fields
	 * as a table, a link to the monitor, and the incident totals when there are any.
	 */
	body(): RemixElement {
		let { t, locale, monitorName, dashboardUrl, incident } = this.#alert;
		let headline = t("emails.alert.heading", { monitor: monitorName, status: this.#status() });

		return (
			<Email.Layout
				lang={locale}
				title={headline}
				preview={t("emails.alert.preview", { monitor: monitorName, status: this.#status() })}
			>
				<Email.Heading>{headline}</Email.Heading>
				<Email.Table rows={this.#fields()} />
				{this.#notes().map((note) => (
					<Email.Text key={note} muted>
						{note}
					</Email.Text>
				))}
				<Email.Button href={dashboardUrl}>{t("emails.alert.action")}</Email.Button>
				{incident ? (
					<Email.Text muted>
						{/*
						 * A key of its own rather than a reworded `emails.alert.incident`: that one
						 * interpolates the per-incident ceiling that no longer exists, and every
						 * translation of it names the ceiling too.
						 */}
						{t("emails.alert.incidentCooldown", {
							sent: incident.sent,
							suppressed: incident.suppressed,
						})}
					</Email.Text>
				) : null}
				<Email.Footer>{t("emails.alert.footer")}</Email.Footer>
			</Email.Layout>
		);
	}

	/**
	 * Sentences the reported fields need but cannot carry, in reading order.
	 *
	 * Both belong to a domain sweep, and both exist because the table alone would mislead.
	 * A record set holding several values has no per-record identity in DNS, so a value
	 * edited inside one is reported as one record no longer resolving plus one new record:
	 * accurate, and read as a bug by anyone not told why. And a newly seen record is stored
	 * disabled on purpose, so the email has to say that nothing is watching it yet and that
	 * accepting or fixing it is the reader's move.
	 */
	#notes(): string[] {
		let { t, snapshot } = this.#alert;
		if (snapshot.type !== "dns") return [];

		let notes: string[] = [];
		if (hasRecordSetEdit(snapshot.findings)) notes.push(t("emails.alert.dns.recordSetEditNote"));
		if (snapshot.recordsNew > 0) notes.push(t("emails.alert.dns.newRecordsNote"));
		return notes;
	}

	/** The word this transition is announced with, shared by the subject and the body. */
	#status(): string {
		return this.#alert.t(statusKey(this.#alert.eventType));
	}

	/** Every reported line: what changed, then the check's own detail, then when. */
	#fields(): AlertField[] {
		let { t, locale, monitorName, monitorType, occurredAt } = this.#alert;

		return [
			{
				label: t("emails.alert.fields.monitor"),
				value: t("emails.alert.values.monitor", { name: monitorName, type: monitorType }),
			},
			{ label: t("emails.alert.fields.status"), value: this.#status() },
			...this.#snapshotFields(),
			{ label: t("emails.alert.fields.time"), value: alertDateTime(occurredAt, locale) },
		];
	}

	/**
	 * The lines specific to the kind of check that ran. Every branch is exhaustive over
	 * the snapshot union, so a new monitor type is a compile error here rather than an
	 * email that quietly reports nothing about it.
	 */
	#snapshotFields(): AlertField[] {
		let { t, locale, snapshot } = this.#alert;
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

				// The counters are the totals and the findings a capped sample of those same
				// buckets, so the difference is exactly what this body is not listing.
				let hidden =
					snapshot.recordsMissing +
					snapshot.recordsChanged +
					snapshot.recordsNew -
					snapshot.findings.length;
				if (hidden > 0) lines.push(t("emails.alert.values.dnsMoreFindings", { count: hidden }));

				/**
				 * One row holding every finding rather than a row each: the table keys its rows
				 * by their label, which two findings of the same kind would share, and reading
				 * them as one block is what keeps the two halves of an edited record set
				 * together.
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

			case "ssl":
				return [
					{ label: t("emails.alert.fields.hostname"), value: snapshot.hostname },
					{ label: t("emails.alert.fields.status"), value: snapshot.status },
					{
						label: t("emails.alert.fields.expiresAt"),
						value: snapshotDateTime(snapshot.expiresAt, locale, none),
					},
				];
		}
	}
}
