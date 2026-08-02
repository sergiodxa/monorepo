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
import type { Address } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { AlertEventSnapshot, SelectAlertEvent } from "~/database/schema";

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

/** One `label: value` line of the transition report, both sides already translated. */
interface AlertField {
	/** Translated name of what the line reports. */
	label: string;
	/** The value as the reader sees it, formatted for their language where it matters. */
	value: string;
}

export namespace AlertEmail {
	/**
	 * What an incident cost in notifications, reported only on the recovery that ends
	 * it. Without it a capped incident is indistinguishable from alerts being dropped.
	 */
	export interface Incident {
		/** Notifications actually delivered during the incident. */
		sent: number;
		/** Notifications withheld by cooldown or by the per-incident cap. */
		suppressed: number;
		/** The per-incident ceiling that withheld them. */
		cap: number;
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
	 * Body tree the mailer renders into both parts: the headline, one line per
	 * reported field, a link to the monitor, and the incident totals when there are any.
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
				{this.#fields().map((field) => (
					<Email.Text key={field.label}>
						{t("emails.alert.field", { label: field.label, value: field.value })}
					</Email.Text>
				))}
				<Email.Button href={dashboardUrl}>{t("emails.alert.action")}</Email.Button>
				{incident ? (
					<Email.Text muted>
						{t("emails.alert.incident", {
							sent: incident.sent,
							suppressed: incident.suppressed,
							cap: incident.cap,
						})}
					</Email.Text>
				) : null}
				<Email.Footer>{t("emails.alert.footer")}</Email.Footer>
			</Email.Layout>
		);
	}

	/** The word this transition is announced with, shared by the subject and the body. */
	#status(): string {
		return this.#alert.t(statusKey(this.#alert.eventType));
	}

	/** Every reported line: what changed, then the check's own detail, then when. */
	#fields(): AlertField[] {
		let { t, monitorName, monitorType, occurredAt } = this.#alert;

		return [
			{
				label: t("emails.alert.fields.monitor"),
				value: t("emails.alert.values.monitor", { name: monitorName, type: monitorType }),
			},
			{ label: t("emails.alert.fields.status"), value: this.#status() },
			...this.#snapshotFields(),
			{ label: t("emails.alert.fields.time"), value: occurredAt.toISOString() },
		];
	}

	/**
	 * The lines specific to the kind of check that ran. Every branch is exhaustive over
	 * the snapshot union, so a new monitor type is a compile error here rather than an
	 * email that quietly reports nothing about it.
	 */
	#snapshotFields(): AlertField[] {
		let { t, snapshot } = this.#alert;
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

			case "dns":
				return [
					{
						label: t("emails.alert.fields.domain"),
						value: t("emails.alert.values.domain", {
							domain: snapshot.domain,
							recordType: snapshot.recordType,
						}),
					},
					{ label: t("emails.alert.fields.status"), value: snapshot.status },
					{
						label: t("emails.alert.fields.resolvedValue"),
						value: snapshot.resolvedValue ?? none,
					},
				];

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
						value: snapshot.lastPingAt ?? t("emails.alert.values.never"),
					},
					{ label: t("emails.alert.fields.nextExpected"), value: snapshot.nextExpectedAt ?? none },
				];

			case "ssl":
				return [
					{ label: t("emails.alert.fields.hostname"), value: snapshot.hostname },
					{ label: t("emails.alert.fields.status"), value: snapshot.status },
					{ label: t("emails.alert.fields.expiresAt"), value: snapshot.expiresAt ?? none },
				];
		}
	}
}
