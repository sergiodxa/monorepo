/**
 * Yesterday's public-trial funnel, as one internal email to whoever configured the
 * deployment: the day's five counters, every conversion itemised, and thirty days of context.
 * It carries no unsubscribe and no translation, since its one reader set it up themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailInput, EmailPropsOutput, EmailTableRow } from "@sdxc/mail";
import type { Handle } from "remix/component";

import { diffInDays, formatDate, formatDateTime } from "@sdxc/dates";
import { createEmail, Email } from "@sdxc/mail";

import type { TrialDailyCounters } from "~/app/models/trial-daily-stats";

import emails from "~/app/emails";

/** The language and zone the report is written in; see the module docblock on both. */
const REPORT_LOCALE = "en";
const REPORT_ZONE = "UTC";

/** What every member of the template reads: the day's report, with the locale and `t` unused. */
type Report = EmailInput<EmailPropsOutput<typeof emails.funnelReport>>;

/** One account that came through the trial, as the report itemises it. */
type Conversion = Report["paid"][number];

namespace ConversionSection {
	/** Props accepted by {@link ConversionSection}. */
	export interface Props {
		/** The account being itemised. */
		conversion: Conversion;
	}
}

/**
 * One converted account: the URLs that brought them in as a caption, then the numbers.
 * The caption identifies the account, since no name, address, or subject appears in
 * this email; a paid account also gets its two payment dates.
 */
function ConversionSection(handle: Handle<ConversionSection.Props>) {
	return () => {
		let { conversion } = handle.props;
		let end = conversion.paidAt ?? conversion.signedUpAt;

		let rows: EmailTableRow[] = [
			{
				label: conversion.paidAt ? "Days to paying" : "Days to signing up",
				value: String(diffInDays(end, conversion.leadCreatedAt, REPORT_ZONE)),
			},
			{ label: "Emails received", value: String(conversion.emailsSent) },
			{ label: "URLs tried", value: `${conversion.urls.length} (${conversion.watchCount} tries)` },
			{ label: "Came from", value: conversion.attribution ?? "unknown" },
		];

		if (conversion.paidAt) {
			rows.push(
				{ label: "Signed up", value: reportInstant(conversion.signedUpAt) },
				{ label: "First payment", value: reportInstant(conversion.paidAt) },
			);
		}

		return (
			<>
				<Email.Text muted size={14}>
					{conversion.urls.length === 0 ? "no URLs recorded" : conversion.urls.join(", ")}
				</Email.Text>
				<Email.Table rows={rows} />
			</>
		);
	};
}

export default createEmail(emails.funnelReport, {
	subject: (report) => subject(report),
	/** The day's table, each conversion itemised, then the trailing totals. */
	body: (handle) => () => {
		let { date, counters, totals, totalDays, paid, signups } = handle.props;
		let heading = `Trial funnel — ${formatDate(utcDay(date), { locale: REPORT_LOCALE, timeZone: REPORT_ZONE })}`;

		return (
			<Email.Layout lang={REPORT_LOCALE} title={heading} preview={subject(handle.props)}>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text muted size={14}>
					Counted over the UTC day.
				</Email.Text>
				<Email.Table rows={counterRows(counters)} />

				{paid.length === 0 ? null : (
					<>
						<Email.Heading level={2}>Paid conversions</Email.Heading>
						{paid.map((conversion) => (
							<ConversionSection key={conversionKey(conversion)} conversion={conversion} />
						))}
					</>
				)}

				{signups.length === 0 ? null : (
					<>
						<Email.Heading level={2}>Free signups</Email.Heading>
						{signups.map((conversion) => (
							<ConversionSection key={conversionKey(conversion)} conversion={conversion} />
						))}
					</>
				)}

				<Email.Heading level={2}>{`Last ${totalDays} days`}</Email.Heading>
				<Email.Table rows={counterRows(totals)} />
			</Email.Layout>
		);
	},
	preview: () => ({
		date: "2026-08-01",
		counters: { newLeads: 3, urlsChecked: 4, emailsSent: 11, freeSignups: 1, paidConversions: 1 },
		totals: { newLeads: 40, urlsChecked: 52, emailsSent: 130, freeSignups: 9, paidConversions: 5 },
		totalDays: 30,
		paid: [
			{
				urls: ["https://ada.example"],
				watchCount: 2,
				emailsSent: 8,
				leadCreatedAt: Date.UTC(2026, 6, 26, 9),
				signedUpAt: Date.UTC(2026, 6, 31, 9),
				paidAt: Date.UTC(2026, 7, 1, 9),
				attribution: null,
			},
		],
		signups: [],
	}),
});

/**
 * The headline, in the subject, because the day this is worth opening is the exception.
 * Leads, signups and paid conversions and not all five counters: URLs and emails are how
 * the work was done, while these three are the funnel itself.
 */
function subject({ date, counters }: Report): string {
	return (
		`Uptime trial ${date} — ` +
		[
			plural(counters.newLeads, "lead"),
			plural(counters.freeSignups, "signup"),
			`${counters.paidConversions} paid`,
		].join(", ")
	);
}

/** The five counters as a table, in funnel order so the drop-off reads down the column. */
function counterRows(counters: TrialDailyCounters): EmailTableRow[] {
	return [
		{ label: "New leads", value: String(counters.newLeads) },
		{ label: "URLs checked", value: String(counters.urlsChecked) },
		{ label: "Emails sent", value: String(counters.emailsSent) },
		{ label: "Free signups", value: String(counters.freeSignups) },
		{ label: "Paid conversions", value: String(counters.paidConversions) },
	];
}

/**
 * A stable key for one conversion's section. The signup instant plus the first URL, because
 * the report is given no identifier it could use — deliberately, since nothing that names a
 * person belongs in an operational email.
 */
function conversionKey(conversion: Conversion): string {
	return `${conversion.signedUpAt.getTime()}:${conversion.urls[0] ?? ""}`;
}

/** Midnight UTC on a `YYYY-MM-DD` day, which is the instant that day's heading renders. */
function utcDay(date: string): Date {
	return new Date(`${date}T00:00:00.000Z`);
}

/** An instant as the report prints it: UTC, and said so, since nothing here is local. */
function reportInstant(date: Date): string {
	return `${formatDateTime(date, { locale: REPORT_LOCALE, timeZone: REPORT_ZONE })} UTC`;
}

/** `1 lead` / `2 leads`. The subject is English-only, so the rule is the English one. */
function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
