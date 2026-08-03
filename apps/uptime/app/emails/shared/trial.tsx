/**
 * Pieces the five free-watch emails share: the status vocabulary they report, the
 * unsubscribe header every one of them carries, the way they abbreviate a URL and
 * render an instant, and the bar-plus-totals report the two digests are built around.
 *
 * These readers never created an account, so there is no stored preference to look up
 * and no settings page to send them to. Everything here is written for that: the copy
 * comes from one `emails.trial.*` prefix, and the way to make the mail stop belongs to
 * the family rather than being a per-email decision.
 *
 * This module is deliberately not an email class and not a base class for the five that
 * are. What the trial emails have in common is copy and a couple of small components,
 * not behaviour: each one derives its own recipient, its own subject and its own body,
 * which is the whole of the `Email` contract. ADR-030 rejects a shared base class for
 * exactly that reason — with `to`, `subject` and `body` all still abstract, the base
 * would hold no behaviour at all and amount to an interface with extra coupling, and
 * the ADR prefers a helper function wherever real logic turns out to be shared. That is
 * what these are. It lives under `shared/` so the top level of `app/emails/` stays the
 * inventory of sendable emails the ADR asks that directory to be.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { EmailTableRow } from "@pkg/mail";
import type { Handle } from "remix/ui";

import { formatDateTime } from "@pkg/dates";
import { Email } from "@pkg/mail";

import { UptimeBar } from "~/app/emails/shared/uptime-bar";
import { APP_ORIGIN } from "~/app/lib/origin";

/**
 * Result of one check on a watched URL. The public trial is HTTP only, so these three
 * are the whole vocabulary — there is no DNS or TCP half to report here, and the bar's
 * colour mapping is total over them without a per-type branch.
 *
 * Declared here rather than taken from the schema on purpose. The wider status enum
 * the ping API works in covers check types the trial cannot produce, and widening
 * these emails to match it would mean copy for states no reader of theirs can reach.
 */
export type TrialStatus = "up" | "degraded" | "down";

/**
 * The unsubscribe endpoint for one lead, which is the same URL under two methods.
 *
 * `GET` renders a confirmation page with a button and changes nothing; `POST` is what
 * actually stops every watch on the address and deletes the lead. That split is not
 * ceremony. Corporate scanners and preview fetchers — Outlook Safe Links, Gmail's own
 * image and link fetcher — follow every URL in a message before a human sees it, so a
 * `GET` that unsubscribed would quietly delete the leads of people who never clicked
 * anything. The visible link in the footer therefore points at the harmless `GET`.
 *
 * The native unsubscribe button Gmail and Apple Mail show is still one click, because
 * {@link trialUnsubscribeHeaders} declares RFC 8058 one-click and those clients `POST`
 * to this URL rather than fetching it. Same URL, and the method is what decides.
 *
 * @param token - The lead's unguessable unsubscribe token.
 * @returns The absolute URL for both the footer link and the headers.
 */
export function trialUnsubscribeUrl(token: string): string {
	return `${APP_ORIGIN}/unsubscribe/${token}`;
}

/**
 * RFC 8058 headers giving the clients that support them a native unsubscribe button.
 * They are worth setting on every one of these messages: the recipients never signed
 * up for an account, so the button is the path most of them will reach for, and Gmail
 * now treats its absence on bulk mail as a deliverability problem.
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

export namespace TrialUnsubscribe {
	/** Props accepted by {@link TrialUnsubscribe}. */
	export interface Props {
		/** The lead's unguessable unsubscribe token. */
		token: string;
		/** Translator already bound to the reader's language. */
		t: TFunction;
	}
}

/**
 * The footer's opt-out: a link, then one sentence saying how much it stops. It is a
 * real anchor so the plain-text alternative keeps the URL, and the sentence spells out
 * that the effect is every watch on the address rather than only the one this message
 * is about, because that is the part a reader would otherwise have to guess.
 *
 * @example <TrialUnsubscribe token={token} t={t} />
 */
export function TrialUnsubscribe(handle: Handle<TrialUnsubscribe.Props>) {
	return () => {
		let { token, t } = handle.props;

		return (
			<>
				<a
					href={trialUnsubscribeUrl(token)}
					style="color:inherit;text-decoration:underline;font-weight:600;"
				>
					{t("emails.trial.stopAction")}
				</a>{" "}
				{t("emails.trial.stop")}
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
 * The URL as a heading should say it: without the scheme, and without the trailing
 * slash a bare origin picks up on its way through `URL`.
 *
 * A heading is the one place the full URL hurts. Mail clients auto-link anything that
 * looks like an address, so `https://api.remix.run/` inside a sentence comes out as a
 * wall of underlined blue at heading size, and the half of it carrying no information
 * is the half that draws the eye. The unabbreviated URL still appears in the message,
 * once, in the table, where it is the value of a row that says it is a URL.
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
 * UTC because a lead is an email address and nothing else — they never created an
 * account, so there is no stored timezone to render this in and no settings page that
 * would let them pick one. Naming the zone is what keeps the timestamp honest, since a
 * reader four hours off would otherwise read it as local and think the check ran at a
 * time it did not.
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
 * One URL's record over one window: the bar, then checks run, uptime, and the slowest
 * response. Shared by the two digests and by the report a repeat submission earns, so a
 * reader who gets six dailies and one weekly is reading the same report at two scales — it
 * is the only thing those two still have in common, since one covers a whole set of URLs
 * for a day and the other one URL for a week. The repeat report reuses it for the same
 * reason it is not a subclass of the wrap-up: what those emails share is this block, not
 * their framing.
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
