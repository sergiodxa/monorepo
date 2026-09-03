/**
 * One team's last full day for one of its members: how many monitors were up, then every
 * monitor with the state it ended the day in and its uptime. A member and a team is the unit,
 * so a reader in three teams gets three emails and every row stays attributable to the
 * dashboard that owns it — which is why the team's name sits in the subject too, alongside the
 * whole result, so the ordinary all-up day is done at the notification (ADR-024).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import type { TeamDigestMonitor } from "~/app/emails/shared/team-digest";

import { DARK_STYLES } from "~/app/emails/shared/palette";
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
		/** Every enabled monitor of the team, sorted by name; always has at least one entry. */
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
	/** The day this email reports; rendering reads only from here. */
	#digest: TeamDailyDigestEmail.Data;

	/**
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
	 * Subject carrying the whole result: the team, and how many of its monitors were up. Two
	 * keys, one per shape of the result, because "all of them" and "some of them" interpolate
	 * different variables; each takes `count`, so a one-monitor team reads in the singular.
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

	/** Body tree the mailer renders into both parts. */
	body(): RemixElement {
		let { t, locale, teamName, monitors, dashboardUrl, preferencesUrl } = this.#digest;
		let heading = t("emails.teamDigest.daily.heading", { team: teamName });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.teamDigest.daily.preview", { team: teamName })}
				darkStyles={DARK_STYLES}
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
