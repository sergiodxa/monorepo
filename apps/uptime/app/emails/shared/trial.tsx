/**
 * Pieces the five free-watch emails share: status vocabulary, the unsubscribe header, URL
 * and instant formatting, and the bar-plus-totals report the two digests are built around.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { EmailTableRow } from "@sdxc/mail";
import type { Handle } from "remix/ui";

import { formatDateTime } from "@sdxc/dates";
import { Email } from "@sdxc/mail";

import { UptimeBar } from "~/app/emails/shared/uptime-bar";
import { APP_ORIGIN } from "~/app/lib/origin";
import routes from "~/routes/web";

/**
 * Result of one check on a watched URL: the whole vocabulary the public HTTP-only trial
 * needs, since the bar's colour mapping is total over exactly these three states.
 *
 * Kept to states a trial reader can actually reach, since the trial only ever produces HTTP checks.
 */
export type TrialStatus = "up" | "degraded" | "down";

/**
 * The unsubscribe endpoint for one lead, which is the same URL under two methods.
 *
 * `GET` renders a confirmation page and changes nothing, since preview fetchers like Outlook
 * Safe Links crawl every link before a human does; `POST` is what actually stops the watches.
 *
 * @param token - The lead's unguessable unsubscribe token.
 * @returns The absolute URL for both the footer link and the headers.
 */
export function trialUnsubscribeUrl(token: string): string {
	return `${APP_ORIGIN}/unsubscribe/${token}`;
}

/**
 * RFC 8058 headers giving the clients that support them a native unsubscribe button.
 *
 * Worth setting on every message here, since these recipients never created an account and
 * Gmail treats a bulk sender without one as a deliverability risk.
 *
 * @param token - The lead's unguessable unsubscribe token.
 * @returns The two headers, ready to merge over the mailer's configured ones.
 */
export function trialUnsubscribeHeaders(token: string): Record<string, string> {
	return {
		"List-Unsubscribe": `<${trialUnsubscribeUrl(token)}>`,
		"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
	};
}

/**
 * The style every footer paragraph carries, since a mail client cannot be trusted to have a
 * default margin on `<p>` and several strip the stylesheet that would have given it one. The
 * gap goes below rather than above so the first paragraph still sits tight under the hairline.
 */
const FOOTER_PARAGRAPH = "margin:0 0 8px;";

/** The same, for the last paragraph, which must not push the footer open at the bottom. */
const FOOTER_PARAGRAPH_LAST = "margin:0;";

/** The look of a link inside the footer: inherits the muted colour it sits in. */
const FOOTER_LINK = "color:inherit;text-decoration:underline;font-weight:600;";

/**
 * Absolute URL of a watch's report page, which only its own token addresses.
 *
 * Built from the typed route so the path cannot drift from the route table, with the origin
 * from {@link APP_ORIGIN} since a relative href in mail resolves against nothing.
 */
export function trialReportUrl(token: string): string {
	return `${APP_ORIGIN}${routes.trial.report.href({ token })}`;
}

export namespace TrialFooter {
	/** Props accepted by {@link TrialFooter}. */
	export interface Props {
		/**
		 * The watch's own `report_token`, when this email reports on a single target and can
		 * therefore point at its durable copy. Omitted where there is no one report to link.
		 */
		reportToken?: string | null;
		/** The lead's unguessable unsubscribe token. */
		unsubscribeToken: string;
		/** Already-translated sentence saying why this message arrived, which each email writes. */
		reason: string;
		/** Translator already bound to the reader's language. */
		t: TFunction;
	}
}

/**
 * The footer every trial email closes with: where the report lives, why this arrived, and how
 * to make it stop, each its own paragraph so the opt-out reads as its own block.
 *
 * @example <TrialFooter reportToken={token} unsubscribeToken={lead} reason={reason} t={t} />
 */
export function TrialFooter(handle: Handle<TrialFooter.Props>) {
	return () => {
		let { reportToken, unsubscribeToken, reason, t } = handle.props;

		return (
			<>
				{reportToken ? (
					<p style={FOOTER_PARAGRAPH}>
						{t("emails.trial.reportLink.body")}{" "}
						<a href={trialReportUrl(reportToken)} style={FOOTER_LINK}>
							{t("emails.trial.reportLink.action")}
						</a>
					</p>
				) : null}
				<p style={FOOTER_PARAGRAPH}>{reason}</p>
				<p style={FOOTER_PARAGRAPH_LAST}>
					<a href={trialUnsubscribeUrl(unsubscribeToken)} style={FOOTER_LINK}>
						{t("emails.trial.stopAction")}
					</a>{" "}
					{t("emails.trial.stop")}
				</p>
			</>
		);
	};
}

/**
 * Locale key holding the word a status is reported with. Written out per status so
 * every key the emails can ask for is greppable in the locale files, the same way the
 * alert email spells its own out.
 */
export function trialStatusKey(status: TrialStatus): string {
	if (status === "up") return "emails.trial.status.up";
	if (status === "degraded") return "emails.trial.status.degraded";
	return "emails.trial.status.down";
}

/**
 * The URL as a heading should say it: a bare host and path, scheme and trailing slash gone.
 *
 * Mail clients auto-link anything that looks like an address, so the full URL at heading size
 * draws the eye to the half that carries no information; it still appears once, in the table.
 *
 * @param url - The watched URL, absolute.
 * @returns The same URL with the scheme and any trailing slash removed.
 */
export function trialDisplayUrl(url: string): string {
	return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * An instant as one of these emails reports it: in the reader's language, and in UTC.
 *
 * UTC because a lead has no account and therefore no stored timezone; naming the zone keeps
 * the timestamp honest for a reader whose local time would otherwise read it as their own.
 *
 * @param date - Instant to render.
 * @param locale - Language the surrounding copy is in.
 * @returns The formatted date and time, with the zone spelled out.
 */
export function trialDateTime(date: Date, locale: string): string {
	return `${formatDateTime(date, { locale, timeZone: "UTC" })} UTC`;
}

/** The numbers a digest reports under a bar. */
export interface TrialStats {
	/** Checks that ran in the reported window. */
	checks: number;
	/** Uptime over the window, already formatted as a percentage without its sign. */
	uptime: string | null;
	/** Slowest response in the window, or `null` when nothing answered. */
	slowestResponseMs: number | null;
}

export namespace TrialReport {
	/** Props accepted by {@link TrialReport}. */
	export interface Props {
		/** One entry per period, oldest first; the email that renders it fixes the granularity. */
		segments: UptimeBar.Status[];
		/** The numbers shown under the bar. */
		stats: TrialStats;
		/** Caption at the oldest end of the bar, supplied by the email that frames it. */
		rangeStart: string;
		/** Caption at the newest end of it. */
		rangeEnd: string;
		/** Translator already bound to the reader's language by the sender. */
		t: TFunction;
	}
}

/**
 * One URL's record over one window: the bar, checks run, uptime, and the slowest response.
 *
 * Shared by the two digests and by the repeat report, so a reader getting six dailies and
 * one weekly reads the same report at two different scales.
 *
 * @example <TrialReport segments={hours} stats={stats} rangeStart={start} rangeEnd={end} t={t} />
 */
export function TrialReport(handle: Handle<TrialReport.Props>) {
	return () => {
		let { segments, stats, rangeStart, rangeEnd, t } = handle.props;
		let none = t("emails.trial.values.none");

		let labels: UptimeBar.Labels = {
			start: rangeStart,
			end: rangeEnd,
			uptime: stats.uptime === null ? null : t("emails.trial.bar.uptime", { value: stats.uptime }),
			legend: {
				up: t("emails.trial.bar.legend.up"),
				degraded: t("emails.trial.bar.legend.degraded"),
				down: t("emails.trial.bar.legend.down"),
				noData: t("emails.trial.bar.legend.noData"),
			},
		};

		let rows: EmailTableRow[] = [
			{ label: t("emails.trial.fields.checks"), value: String(stats.checks) },
			{
				label: t("emails.trial.fields.uptime"),
				value:
					stats.uptime === null
						? none
						: t("emails.trial.values.percentage", { value: stats.uptime }),
			},
			{
				label: t("emails.trial.fields.slowest"),
				value:
					stats.slowestResponseMs === null
						? none
						: t("emails.trial.values.milliseconds", { value: stats.slowestResponseMs }),
			},
		];

		return (
			<>
				<UptimeBar segments={segments} labels={labels} />
				<Email.Table rows={rows} />
			</>
		);
	};
}
