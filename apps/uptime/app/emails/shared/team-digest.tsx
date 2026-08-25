/**
 * Pieces the two team digests share: the monitor list, its worst-first order, and the
 * footer that links to the reader's own settings.
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
import { statusClass, statusFill } from "~/app/emails/shared/uptime-bar";
import { absoluteUrl } from "~/app/lib/origin";
import routes from "~/routes/web";

/** Column header and caption style, matching the uptime bar's own captions. */
const HEADER_STYLE = `font-family:inherit;font-size:12px;line-height:1.5;color:${MUTED_COLOR};`;

/** Shared style of every body cell; the hairline is added per row. */
const CELL_STYLE = "font-family:inherit;font-size:14px;line-height:1.4;vertical-align:top;";

/**
 * How a monitor's window sorts, worst first.
 *
 * Down, then degraded, then unchecked, then up, since whoever opens the digest reads top to
 * bottom and the row needing attention should surface before rows that only confirm things are fine.
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
 * Counts only the up monitors, so the summary line reads as a fraction of monitors that need
 * no attention from whoever is on call.
 *
 * @param monitors - The window's monitors.
 * @returns The count for the summary sentence.
 */
export function countHealthy(monitors: TeamDigestMonitor[]): number {
	return monitors.filter((monitor) => monitor.status === "up").length;
}

/**
 * DOM id of the account page's email-settings section, shared with
 * {@link teamDigestPreferencesUrl} so renaming the section here moves every link with it.
 */
export const EMAIL_PREFERENCES_ANCHOR = "emails";

/**
 * Absolute URL of the reader's own email settings, anchored at the switches.
 *
 * The account page is scoped by team in the URL even though its settings belong to the person,
 * so a digest links through the team the reader was already thinking about.
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
 * The reported day, named in the reader's language but kept on its UTC calendar date.
 *
 * Stays on the UTC day that `monitor_daily_stats` keys its rows on, since shifting to the
 * reader's zone could relabel the day away from the one the numbers describe.
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
 * Points to the settings page so a member can choose which digests to keep across every team,
 * satisfying Gmail's deliverability requirement for an unsubscribe path on bulk mail.
 *
 * @param preferencesUrl - Absolute URL of the settings section, anchor included.
 * @returns The header, ready to merge over the mailer's configured ones.
 */
export function teamDigestUnsubscribeHeaders(preferencesUrl: string): Record<string, string> {
	return { "List-Unsubscribe": `<${preferencesUrl}>` };
}

/**
 * Every monitor as one row, keyed on its kind and id together since two monitors can share a
 * name across the four monitor tables that generate ids independently. Real
 * `<th scope="col">` headers let a screen reader announce each column per row.
 *
 * @example <TeamDigestMonitorList monitors={sortTeamDigestMonitors(monitors)} t={t} />
 */
export function TeamDigestMonitorList(handle: Handle<TeamDigestMonitorList.Props>) {
	return () => {
		let { monitors, t } = handle.props;
		if (monitors.length === 0) return null;

		return (
			<table
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style="width:100%;margin:0 0 16px;border-collapse:collapse;"
			>
				<thead>
					<tr>
						<th
							scope="col"
							align="left"
							class="mail-muted"
							style={`padding:0 12px 8px 0;${HEADER_STYLE}`}
						>
							{t("emails.teamDigest.columns.monitor")}
						</th>
						<th
							scope="col"
							align="right"
							class="mail-muted"
							style={`padding:0 12px 8px 0;${HEADER_STYLE}text-align:right;`}
						>
							{t("emails.teamDigest.columns.status")}
						</th>
						<th
							scope="col"
							align="right"
							class="mail-muted"
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
								class="mail-text mail-rule"
								style={`padding:10px 12px 10px 0;border-top:1px solid ${BORDER_COLOR};${CELL_STYLE}color:${TEXT_COLOR};font-weight:600;word-break:break-word;`}
							>
								{monitor.name}{" "}
								<span class="mail-muted" style={`font-weight:400;color:${MUTED_COLOR};`}>
									{t(teamDigestTypeKey(monitor.type))}
								</span>
							</td>
							<td
								align="right"
								class={`${monitor.status === null ? "mail-muted" : statusClass(monitor.status, "ink")} mail-rule`}
								style={`padding:10px 12px 10px 0;border-top:1px solid ${BORDER_COLOR};${CELL_STYLE}text-align:right;white-space:nowrap;font-weight:600;color:${monitor.status === null ? MUTED_COLOR : statusFill(monitor.status)};`}
							>
								{t(teamDigestStatusKey(monitor.status))}
							</td>
							<td
								align="right"
								class="mail-text mail-rule"
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
 * The footer both digests carry: one sentence naming the team, then a link to the switches
 * that stop it.
 *
 * Says "choose" because the page lets a member decide which digests they want to keep.
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
