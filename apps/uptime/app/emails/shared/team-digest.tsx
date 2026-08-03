/**
 * Pieces the two team digests share: the shape one monitor's window is reported in, the order
 * a list of them is read in, the list itself, and the footer that says why the email arrived
 * and where to turn it off.
 *
 * These readers have accounts, which is the whole difference from the free-watch emails and the
 * reason this module exists beside theirs rather than inside them. A member has a dashboard, so
 * a digest does not have to be the report — it names what changed and links to the place that
 * holds the detail. A member also has a settings page, so making the mail stop is a switch they
 * own rather than a token in a URL, and the footer's job is to point at it.
 *
 * Like `shared/trial`, this is deliberately not an email class and not a base class for the two
 * that are: `to`, `subject` and `body` are the whole of the `Email` contract and all three vary,
 * so a base class would hold no behaviour at all (ADR-030). What genuinely repeats is the
 * monitor list and the footer, and those are components.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Handle } from "remix/ui";

import { formatDate } from "@pkg/dates";

import type { DailyStatsMonitorType } from "~/app/data/monitor-daily-stats";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { BORDER_COLOR, MUTED_COLOR, TEXT_COLOR } from "~/app/emails/shared/palette";
import { statusFill } from "~/app/emails/shared/uptime-bar";
import { absoluteUrl } from "~/app/lib/origin";
import routes from "~/routes/web";

/** Column header and caption style, matching the uptime bar's own captions. */
const HEADER_STYLE = `font-family:inherit;font-size:12px;line-height:1.5;color:${MUTED_COLOR};`;

/** Shared style of every body cell; the hairline is added per row. */
const CELL_STYLE = "font-family:inherit;font-size:14px;line-height:1.4;vertical-align:top;";

/**
 * How a monitor's window sorts, worst first.
 *
 * Down before degraded before unchecked before up, because a digest is read top-down and by
 * whoever is on call: the row that might need somebody this morning has to be the first one,
 * and on the ordinary day when every row says the same thing the order costs nothing. An
 * unchecked monitor sits between the two kinds of bad news and the good — it is not a failure,
 * but it is not the reassurance the reader came for either.
 */
const ORDER: Record<"up" | "degraded" | "down" | "none", number> = {
	down: 0,
	degraded: 1,
	none: 2,
	up: 3,
};

export namespace TeamDigestMonitorList {
	/** Props accepted by {@link TeamDigestMonitorList}. */
	export interface Props {
		/** The monitors to list, in the order they should be read. */
		monitors: TeamDigestMonitor[];
		/** Translator already bound to the reader's language. */
		t: TFunction;
	}
}

/** One monitor's window, as either digest reports it. */
export interface TeamDigestMonitor {
	/** The monitor's own id, which with {@link type} keys its row. */
	id: string;
	/** Name the team gave it. */
	name: string;
	/** Which kind of monitor it is, reported beside the name. */
	type: DailyStatsMonitorType;
	/** Where it stood over the window; `null` when nothing checked it. */
	status: UptimeBar.Status;
	/** Uptime over the window, already formatted as a percentage without its sign. */
	uptime: string | null;
}

/**
 * Locale key holding the word a status is reported with. Written out per status so every key
 * the digests can ask for is greppable in the locale files, and total over the union so an
 * unnamed state is impossible.
 */
export function teamDigestStatusKey(status: UptimeBar.Status): string {
	if (status === "up") return "emails.teamDigest.status.up";
	if (status === "degraded") return "emails.teamDigest.status.degraded";
	if (status === "down") return "emails.teamDigest.status.down";
	return "emails.teamDigest.status.noData";
}

/** The same, for the kind of monitor a row is about. */
export function teamDigestTypeKey(type: DailyStatsMonitorType): string {
	if (type === "http") return "emails.teamDigest.types.http";
	if (type === "dns") return "emails.teamDigest.types.dns";
	if (type === "tcp") return "emails.teamDigest.types.tcp";
	return "emails.teamDigest.types.cron";
}

/**
 * The monitors in reading order: worst first, and alphabetical within a status because the
 * caller hands them over sorted by name and this sort is stable.
 *
 * @param monitors - The window's monitors, sorted by name.
 * @returns A new array, worst first.
 */
export function sortTeamDigestMonitors(monitors: TeamDigestMonitor[]): TeamDigestMonitor[] {
	return [...monitors].sort(
		(left, right) => ORDER[left.status ?? "none"] - ORDER[right.status ?? "none"],
	);
}

/**
 * How many of them were up over the whole window.
 *
 * Up only. A degraded monitor answered every time and still is not what a reader means by
 * fine, and an unchecked one is not something this email is in a position to vouch for — so
 * both are counted against the total, and the summary line reads as a fraction of monitors
 * that need no attention.
 *
 * @param monitors - The window's monitors.
 * @returns The count for the summary sentence.
 */
export function countHealthy(monitors: TeamDigestMonitor[]): number {
	return monitors.filter((monitor) => monitor.status === "up").length;
}

/**
 * DOM id of the email-settings section on the account page, and therefore the fragment every
 * digest's footer link and unsubscribe header ends in.
 *
 * Exported so the page and the link are one decision: the account page renders its section with
 * this as its `id`, and {@link teamDigestPreferencesUrl} appends it. Renaming the section here
 * moves the link with it, where two literals would let the link quietly land at the top of a page
 * whose switches are three sections down.
 */
export const EMAIL_PREFERENCES_ANCHOR = "emails";

/**
 * Absolute URL of the reader's own email settings, anchored at the switches.
 *
 * The account page lives under a team in the URL even though everything on it belongs to the
 * person — the `:team` only picks which shell wraps it — so a digest links through the team it is
 * about, which is the team the reader was already thinking about when they opened the email.
 *
 * @param teamSlug - Slug of the team the digest reported on.
 * @returns The absolute URL, fragment included.
 */
export function teamDigestPreferencesUrl(teamSlug: string): string {
	let path = routes.app.team.account.href({ team: teamSlug });
	return `${absoluteUrl(path)}#${EMAIL_PREFERENCES_ANCHOR}`;
}

/**
 * Absolute URL of the team's dashboard, which is where both digests send a reader who wants the
 * detail a digest deliberately leaves out.
 *
 * @param teamSlug - Slug of the team the digest reported on.
 * @returns The absolute URL.
 */
export function teamDigestDashboardUrl(teamSlug: string): string {
	return absoluteUrl(routes.app.team.dashboard.index.href({ team: teamSlug }));
}

/**
 * One of the reported days as the copy names it: in the reader's language, and as the UTC day it
 * is.
 *
 * UTC because that is the day the roll-up counted. `monitor_daily_stats` keys its rows on the
 * UTC calendar day, so re-rendering "2026-08-02" in a reader's own zone would move the label off
 * the window the numbers describe — a reader in Tokyo would be told a figure for the 3rd that
 * was measured over the 2nd. The zone is not spelled out, because a whole day named as a date
 * reads as a date rather than as a timestamp somebody might convert.
 *
 * @param date - The UTC day, as `YYYY-MM-DD`.
 * @param locale - Language the surrounding copy is in.
 * @returns The day, formatted for that language.
 */
export function teamDigestDay(date: string, locale: string): string {
	return formatDate(new Date(`${date}T00:00:00.000Z`), { locale, timeZone: "UTC" });
}

/**
 * RFC 2369 unsubscribe header pointing at the reader's own settings page.
 *
 * Worth setting on a digest for the same reason the trial emails set theirs: Gmail treats the
 * absence of an unsubscribe path on bulk mail as a deliverability problem, and a member who
 * wants the mail to stop should not have to hunt for the switch.
 *
 * Deliberately without `List-Unsubscribe-Post`. One-click means the client `POST`s the URL
 * itself, with no session and no chance to ask anything, and this setting is not one email but
 * a list of them — the reader is choosing which digests they want, per account and across every
 * team they belong to. So the header points at the page that shows those switches, which is the
 * same place the footer link goes and the same page an authenticated reader is already able to
 * reach.
 *
 * @param preferencesUrl - Absolute URL of the settings section, anchor included.
 * @returns The header, ready to merge over the mailer's configured ones.
 */
export function teamDigestUnsubscribeHeaders(preferencesUrl: string): Record<string, string> {
	return { "List-Unsubscribe": `<${preferencesUrl}>` };
}

/**
 * Every monitor as one row: its name and kind, the status it ended the window in, and its
 * uptime over that window.
 *
 * A table with a header row rather than the label-and-value pairs `Email.Table` renders,
 * because this is a list of like things and the point is to run an eye down the status column.
 * Rows are keyed on the kind and the id together: two monitors can share a name, and the four
 * monitor tables generate ids independently of each other.
 *
 * @example <TeamDigestMonitorList monitors={sortTeamDigestMonitors(monitors)} t={t} />
 */
export function TeamDigestMonitorList(handle: Handle<TeamDigestMonitorList.Props>) {
	return () => {
		let { monitors, t } = handle.props;
		if (monitors.length === 0) return null;

		return (
			/*
			 * The one table in this app's email that is not `role="presentation"`: every other one
			 * is layout, and this one is three labelled columns of like rows, which is what a table
			 * is for. So its headers are real `<th scope="col">` cells and a screen reader can
			 * announce "API, Status, Down" instead of reading a grid of loose values.
			 */
			<table
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style="width:100%;margin:0 0 16px;border-collapse:collapse;"
			>
				<thead>
					<tr>
						<th scope="col" align="left" style={`padding:0 12px 8px 0;${HEADER_STYLE}`}>
							{t("emails.teamDigest.columns.monitor")}
						</th>
						<th
							scope="col"
							align="right"
							style={`padding:0 12px 8px 0;${HEADER_STYLE}text-align:right;`}
						>
							{t("emails.teamDigest.columns.status")}
						</th>
						<th
							scope="col"
							align="right"
							style={`padding:0 0 8px;${HEADER_STYLE}text-align:right;`}
						>
							{t("emails.teamDigest.columns.uptime")}
						</th>
					</tr>
				</thead>
				<tbody>
					{monitors.map((monitor) => (
						<tr key={`${monitor.type}:${monitor.id}`}>
							<td
								style={`padding:10px 12px 10px 0;border-top:1px solid ${BORDER_COLOR};${CELL_STYLE}color:${TEXT_COLOR};font-weight:600;word-break:break-word;`}
							>
								{monitor.name}{" "}
								<span style={`font-weight:400;color:${MUTED_COLOR};`}>
									{t(teamDigestTypeKey(monitor.type))}
								</span>
							</td>
							<td
								align="right"
								style={`padding:10px 12px 10px 0;border-top:1px solid ${BORDER_COLOR};${CELL_STYLE}text-align:right;white-space:nowrap;font-weight:600;color:${monitor.status === null ? MUTED_COLOR : statusFill(monitor.status)};`}
							>
								{t(teamDigestStatusKey(monitor.status))}
							</td>
							<td
								align="right"
								style={`padding:10px 0;border-top:1px solid ${BORDER_COLOR};${CELL_STYLE}text-align:right;white-space:nowrap;color:${TEXT_COLOR};`}
							>
								{monitor.uptime === null
									? t("emails.teamDigest.values.none")
									: t("emails.teamDigest.values.percentage", { value: monitor.uptime })}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		);
	};
}

export namespace TeamDigestFooter {
	/** Props accepted by {@link TeamDigestFooter}. */
	export interface Props {
		/** Team the digest reported on, named so a reader in several knows which. */
		teamName: string;
		/** Absolute URL of the reader's email settings, anchor included. */
		preferencesUrl: string;
		/** Translator already bound to the reader's language. */
		t: TFunction;
	}
}

/**
 * The footer both digests carry: one sentence naming the team the email is about, then a link
 * to the switches that stop it.
 *
 * A real anchor, so the plain-text alternative keeps the URL. It says "choose" rather than
 * "unsubscribe" because that is what the page does — the reader is deciding which digests they
 * want, not ending a relationship with the product they pay for.
 *
 * @example <TeamDigestFooter teamName={team} preferencesUrl={url} t={t} />
 */
export function TeamDigestFooter(handle: Handle<TeamDigestFooter.Props>) {
	return () => {
		let { teamName, preferencesUrl, t } = handle.props;

		return (
			<>
				{t("emails.teamDigest.footer", { team: teamName })}{" "}
				<a href={preferencesUrl} style="color:inherit;text-decoration:underline;font-weight:600;">
					{t("emails.teamDigest.manageAction")}
				</a>
			</>
		);
	};
}
