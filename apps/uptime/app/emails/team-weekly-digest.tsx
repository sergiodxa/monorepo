/**
 * One team's last seven days, in one email, to one of its members: the week
 * as a bar, how many monitors got through it clean, then every monitor as a
 * row with its own week. Each bar segment is the worst status any monitor
 * reported that day, so a monitor that failed and recovered still shows as
 * the day it failed (ADR-024).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { TeamDigestMonitor } from "~/app/emails/shared/team-digest";
import type { UptimeBar as UptimeBarTypes } from "~/app/emails/shared/uptime-bar";

import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TeamDigestFooter,
	TeamDigestMonitorList,
	countHealthy,
	sortTeamDigestMonitors,
	teamDigestDay,
	teamDigestUnsubscribeHeaders,
} from "~/app/emails/shared/team-digest";
import { UptimeBar } from "~/app/emails/shared/uptime-bar";

export namespace TeamWeeklyDigestEmail {
	/** Everything the weekly digest needs: one member, one team, and the team's week. */
	export interface Data {
		/** Address of the member this copy is for. */
		to: string;
		/** Name of the team being reported on, as the team wrote it. */
		teamName: string;
		/** First reported UTC day, as `YYYY-MM-DD`. */
		since: string;
		/** Last one, inclusive. */
		until: string;
		/** The team's seven days, oldest first; a day nothing was checked on is `null`. */
		segments: UptimeBarTypes.Status[];
		/** The team's uptime over the week, already formatted; `null` when nothing was checked. */
		uptime: string | null;
		/** Every enabled monitor of the team, sorted by name; never empty. */
		monitors: TeamDigestMonitor[];
		/** Absolute URL of the team's dashboard. */
		dashboardUrl: string;
		/** Absolute URL of the reader's email settings, anchor included. */
		preferencesUrl: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * A team's week as its members read it on a Monday.
 *
 * @example await mailer.send(new TeamWeeklyDigestEmail({ to, teamName, segments, monitors, locale, t }));
 */
export class TeamWeeklyDigestEmail implements Email {
	/** The week this email reports, fully resolved so rendering stays synchronous. */
	#digest: TeamWeeklyDigestEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param digest - The team's week, its links, and the translator for them.
	 */
	constructor(digest: TeamWeeklyDigestEmail.Data) {
		this.#digest = digest;
	}

	/** The one member this copy is addressed to. */
	get to(): Address {
		return { email: this.#digest.to };
	}

	/**
	 * Subject carrying the whole result: the team, and how many of its monitors were up all week.
	 * Two keys, and a `count` on each, for the same reasons the daily digest has both.
	 */
	get subject(): string {
		let { t, teamName, monitors } = this.#digest;
		let total = monitors.length;
		let up = countHealthy(monitors);

		if (up === total) {
			return t("emails.teamDigest.weekly.subjectAll", { team: teamName, count: total });
		}

		return t("emails.teamDigest.weekly.subject", { team: teamName, up, count: total });
	}

	/** Unsubscribe header pointing at the settings page, for the clients that surface one. */
	get headers(): Record<string, string> {
		return teamDigestUnsubscribeHeaders(this.#digest.preferencesUrl);
	}

	/** Body tree: the headline, the roll-up, the week's bar, the monitor list, the link, the footer. */
	body(): RemixElement {
		let { t, locale, teamName, segments, monitors, dashboardUrl, preferencesUrl } = this.#digest;
		let heading = t("emails.teamDigest.weekly.heading", { team: teamName });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.teamDigest.weekly.preview", { team: teamName })}
				darkStyles={DARK_STYLES}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>{this.#summary()}</Email.Text>
				<UptimeBar segments={segments} labels={this.#labels()} />
				<TeamDigestMonitorList monitors={sortTeamDigestMonitors(monitors)} t={t} />
				<Email.Button href={dashboardUrl}>{t("emails.teamDigest.action")}</Email.Button>
				<Email.Footer>
					<TeamDigestFooter teamName={teamName} preferencesUrl={preferencesUrl} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	}

	/** The roll-up line, worded as "all of them" when the whole week was clean. */
	#summary(): string {
		let { t, monitors } = this.#digest;
		let total = monitors.length;
		let up = countHealthy(monitors);

		if (up === total) return t("emails.teamDigest.weekly.summaryAll", { count: total });
		return t("emails.teamDigest.weekly.summary", { up, count: total });
	}

	/**
	 * The bar's captions: the two ends of the window as dates rather than as "7 days ago", since
	 * the window is a fixed range of whole days and naming it exactly costs nothing.
	 */
	#labels(): UptimeBarTypes.Labels {
		let { t, locale, since, until, uptime } = this.#digest;

		return {
			start: teamDigestDay(since, locale),
			end: teamDigestDay(until, locale),
			uptime: uptime === null ? null : t("emails.teamDigest.bar.uptime", { value: uptime }),
			legend: {
				up: t("emails.teamDigest.bar.legend.up"),
				degraded: t("emails.teamDigest.bar.legend.degraded"),
				down: t("emails.teamDigest.bar.legend.down"),
				noData: t("emails.teamDigest.bar.legend.noData"),
			},
		};
	}
}
