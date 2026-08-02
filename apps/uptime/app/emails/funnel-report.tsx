/**
 * Yesterday's public-trial funnel, as one internal email: the five counters for the day,
 * every conversion it produced itemised, and thirty days of context underneath.
 *
 * It is written as a report rather than as mail. There is no call to action, no branding
 * beyond the layout kit's defaults, and — the part worth stating because every other email
 * in this directory does the opposite — **no unsubscribe link and no RFC 8058 headers**.
 * Those exist because the trial emails go to strangers who never asked for an account and
 * must be able to make them stop; this one goes to an address an operator put in a worker
 * variable, and offering to delete their own reporting would be nonsense.
 *
 * The whole report is in the subject as well as the body, because the common day is one
 * where nothing needs acting on and the point is to be readable from a notification.
 *
 * ## Why this email is not translated
 *
 * Every other email here takes a `t` and draws its copy from `app/locales`, and this one
 * deliberately does not. The rule exists because user-facing copy has readers whose language
 * we do not choose. This has exactly one reader, at exactly one address, chosen by whoever
 * configured the deployment — there is no recipient locale to resolve, so the translator
 * would be constructed only to be handed the fallback language every single time. Six
 * dictionaries of operational vocabulary that five of them would never render, and a
 * six-file edit for every column added to the report, buys nothing. If this email ever
 * acquires a second reader whose language differs, that is the moment to move the copy —
 * and the class is small enough that the move is mechanical.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address, EmailTableRow } from "@pkg/mail";
import type { Handle, RemixElement } from "remix/ui";

import { diffInDays, formatDate, formatDateTime } from "@pkg/dates";
import { Email } from "@pkg/mail";

import type { TrialDailyCounters } from "~/app/data/trial-daily-stats";

/** The language and zone the report is written in; see the module docblock on both. */
const REPORT_LOCALE = "en";
const REPORT_ZONE = "UTC";

export namespace FunnelReportEmail {
	/** One account that came through the trial, as the report itemises it. */
	export interface Conversion {
		/** The distinct URLs they tried, as recorded at sign-up. */
		urls: string[];
		/** How many times they used the form, which can exceed the number of URLs. */
		watchCount: number;
		/** How many trial emails they had received by the time they signed up. */
		emailsSent: number;
		/** When they first handed over an address. */
		leadCreatedAt: Date;
		/** When they signed in and became an account. */
		signedUpAt: Date;
		/** When their first payment landed, or `null` for a free signup. */
		paidAt: Date | null;
	}

	/** Everything the report shows; all of it already counted by the job. */
	export interface Data {
		/** The internal address this goes to, from the worker's `FUNNEL_REPORT_TO`. */
		to: string;
		/** The reported UTC day, as `YYYY-MM-DD`. */
		date: string;
		/** That day's five counters. */
		counters: TrialDailyCounters;
		/** The same five summed over the trailing window, for context. */
		totals: TrialDailyCounters;
		/** How many days {@link totals} covers, so the heading can say so. */
		totalDays: number;
		/** Accounts whose first payment landed on the reported day. */
		paid: Conversion[];
		/** Accounts that signed up free on the reported day and have not paid. */
		signups: Conversion[];
	}
}

namespace ConversionSection {
	/** Props accepted by {@link ConversionSection}. */
	export interface Props {
		/** The account being itemised. */
		conversion: FunnelReportEmail.Conversion;
	}
}

/**
 * One converted account: the URLs that brought them in as a caption, then the numbers.
 *
 * The URL line is a caption rather than a table row because it is what identifies the
 * account — no name, no address and no subject appears in this email, and the URLs are the
 * only human-readable thing a conversion record holds. Stacked tables would otherwise read
 * as one long table with no idea where one account ends and the next begins.
 *
 * A paid account gets the two dates as well; a free one is deliberately shorter, because the
 * interesting question about it is only how long and how many emails it took to get there.
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

/**
 * The morning-after report on the public trial, addressed to whoever operates it.
 *
 * @example await mailer.send(new FunnelReportEmail({ to, date, counters, totals, ... }));
 */
export class FunnelReportEmail implements Email {
	/** The day this email reports; nothing is loaded while rendering. */
	#report: FunnelReportEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param report - The day's counters, its conversions, and the trailing totals.
	 */
	constructor(report: FunnelReportEmail.Data) {
		this.#report = report;
	}

	/** The internal recipient the deployment names; there is never more than one. */
	get to(): Address {
		return { email: this.#report.to };
	}

	/**
	 * The headline, in the subject, because the day this is worth opening is the exception.
	 * Leads, signups and paid conversions and not all five counters: URLs and emails are how
	 * the work was done, while these three are the funnel itself.
	 */
	get subject(): string {
		let { date, counters } = this.#report;

		return (
			`Uptime trial ${date} — ` +
			[
				plural(counters.newLeads, "lead"),
				plural(counters.freeSignups, "signup"),
				`${counters.paidConversions} paid`,
			].join(", ")
		);
	}

	/** Body tree: the day's table, each conversion itemised, then the trailing totals. */
	body(): RemixElement {
		let { date, counters, totals, totalDays, paid, signups } = this.#report;
		let heading = `Trial funnel — ${formatDate(utcDay(date), { locale: REPORT_LOCALE, timeZone: REPORT_ZONE })}`;

		return (
			<Email.Layout lang={REPORT_LOCALE} title={heading} preview={this.subject}>
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
	}
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
function conversionKey(conversion: FunnelReportEmail.Conversion): string {
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
