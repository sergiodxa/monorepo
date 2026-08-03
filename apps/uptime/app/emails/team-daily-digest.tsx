/**
 * One team's last full day, in one email, to one of its members: how many of its monitors were
 * up, then every monitor as a row with the state it ended the day in and its uptime.
 *
 * The unit is the pair — a member and a team — not either one alone. Somebody in three teams gets
 * three of these, because a monitor list is only readable next to the name of the team that owns
 * it, and merging three teams into one email would make every row ambiguous about which
 * dashboard it belongs to. That is also why the team's name is in the subject rather than only in
 * the body: the inbox is where a reader in several teams decides which one this is about.
 *
 * **No bars and no per-monitor detail.** These readers have a dashboard, so the digest's job is
 * to say what deserves a look and get out of the way — the free-watch digests carry a full report
 * because their readers have nowhere else to see one, and copying that shape here would produce a
 * twenty-monitor email nobody reads to the end. The whole result is also in the subject, so on
 * the ordinary day when everything was up the reader is done at the notification (ADR-024).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { TeamDigestMonitor } from "~/app/emails/shared/team-digest";

import {
	TeamDigestFooter,
	TeamDigestMonitorList,
	countHealthy,
	sortTeamDigestMonitors,
	teamDigestDay,
	teamDigestUnsubscribeHeaders,
} from "~/app/emails/shared/team-digest";

export namespace TeamDailyDigestEmail {
	/** Everything the daily digest needs: one member, one team, and the team's day. */
	export interface Data {
		/** Address of the member this copy is for. */
		to: string;
		/** Name of the team being reported on, as the team wrote it. */
		teamName: string;
		/** The reported UTC day, as `YYYY-MM-DD`. */
		date: string;
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
 * A team's day as its members read it over breakfast.
 *
 * @example await mailer.send(new TeamDailyDigestEmail({ to, teamName, date, monitors, locale, t }));
 */
export class TeamDailyDigestEmail implements Email {
	/** The day this email reports; nothing is loaded while rendering. */
	#digest: TeamDailyDigestEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param digest - The team's day, its links, and the translator for them.
	 */
	constructor(digest: TeamDailyDigestEmail.Data) {
		this.#digest = digest;
	}

	/** The one member this copy is addressed to. */
	get to(): Address {
		return { email: this.#digest.to };
	}

	/**
	 * Subject carrying the whole result: the team, and how many of its monitors were up.
	 *
	 * Two keys rather than one, because "all of them" and "some of them" interpolate different
	 * variables and no plural rule can vary that. Each of the two still takes `count`, so the
	 * team with one monitor — the state every team starts in — is not told that "all 1 monitors"
	 * were up.
	 */
	get subject(): string {
		let { t, teamName, monitors } = this.#digest;
		let total = monitors.length;
		let up = countHealthy(monitors);

		if (up === total) {
			return t("emails.teamDigest.daily.subjectAll", { team: teamName, count: total });
		}

		return t("emails.teamDigest.daily.subject", { team: teamName, up, count: total });
	}

	/** Unsubscribe header pointing at the settings page, for the clients that surface one. */
	get headers(): Record<string, string> {
		return teamDigestUnsubscribeHeaders(this.#digest.preferencesUrl);
	}

	/** Body tree: the headline, the roll-up line, the monitor list, the dashboard link, the footer. */
	body(): RemixElement {
		let { t, locale, teamName, monitors, dashboardUrl, preferencesUrl } = this.#digest;
		let heading = t("emails.teamDigest.daily.heading", { team: teamName });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.teamDigest.daily.preview", { team: teamName })}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>{this.#summary()}</Email.Text>
				<TeamDigestMonitorList monitors={sortTeamDigestMonitors(monitors)} t={t} />
				<Email.Button href={dashboardUrl}>{t("emails.teamDigest.action")}</Email.Button>
				<Email.Footer>
					<TeamDigestFooter teamName={teamName} preferencesUrl={preferencesUrl} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	}

	/** The roll-up line, worded as "all of them" when nothing needs attention. */
	#summary(): string {
		let { t, locale, date, monitors } = this.#digest;
		let day = teamDigestDay(date, locale);
		let total = monitors.length;
		let up = countHealthy(monitors);

		if (up === total) {
			return t("emails.teamDigest.daily.summaryAll", { count: total, date: day });
		}

		return t("emails.teamDigest.daily.summary", { up, count: total, date: day });
	}
}
