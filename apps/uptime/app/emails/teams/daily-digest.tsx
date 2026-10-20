/**
 * One team's last full day for one of its members: how many monitors were up, then every
 * monitor with the state it ended the day in and its uptime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailInput, EmailPropsOutput } from "@sdxc/mail";

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TeamDigestFooter,
	TeamDigestMonitorList,
	TeamDigestTraceList,
	countHealthy,
	sortTeamDigestMonitors,
	teamDigestDay,
	TEAM_DIGEST_MAILING_LISTS,
} from "~/app/emails/shared/team-digest";

/** What every member of the template reads: the team's day, the reader's locale and `t`. */
type Digest = EmailInput<EmailPropsOutput<typeof emails.teams.dailyDigest>>;

export default createEmail(emails.teams.dailyDigest, {
	/**
	 * Two keys, one per shape of the result, because "all of them" and "some of them"
	 * interpolate different variables; each takes `count`, so a one-monitor team reads in the
	 * singular.
	 */
	subject: ({ t, teamName, monitors }) => {
		let total = monitors.length;
		let up = countHealthy(monitors);

		if (up === total) {
			return t("emails.teamDigest.daily.subjectAll", { team: teamName, count: total });
		}

		return t("emails.teamDigest.daily.subject", { team: teamName, up, count: total });
	},
	unsubscribe: ({ unsubscribeUrl }) => ({ url: unsubscribeUrl }),
	/** This digest's own list, so unsubscribing from it leaves the other digest on. */
	list: () => TEAM_DIGEST_MAILING_LISTS.daily,
	body: (handle) => () => {
		let { t, locale, teamName, monitors, traces, dashboardUrl, preferencesUrl } = handle.props;
		let heading = t("emails.teamDigest.daily.heading", { team: teamName });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.teamDigest.daily.preview", { team: teamName })}
				darkStyles={DARK_STYLES}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>{summary(handle.props)}</Email.Text>
				<TeamDigestMonitorList monitors={sortTeamDigestMonitors(monitors)} t={t} />
				<TeamDigestTraceList traces={traces} t={t} />
				<Email.Button href={dashboardUrl}>{t("emails.teamDigest.action")}</Email.Button>
				<Email.Footer>
					<TeamDigestFooter teamName={teamName} preferencesUrl={preferencesUrl} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		teamName: "Acme",
		date: "2026-08-02",
		monitors: [
			{ id: "website", name: "Website", type: "http", status: "up", uptime: "100" },
			{ id: "api", name: "API", type: "http", status: "down", uptime: "42.5" },
		],
		traces: [
			{
				monitorName: "Checkout",
				downloadUrl: "https://uptime.sergiodxa.com/acme/flows/flow-1/results/result-1/trace",
			},
		],
		dashboardUrl: "https://uptime.sergiodxa.com/acme",
		preferencesUrl: "https://uptime.sergiodxa.com/acme/account#emails",
		unsubscribeUrl: "https://uptime.sergiodxa.com/digests/unsubscribe/preview",
	}),
});

/** The roll-up line, worded as "all of them" when the whole day was clean. */
function summary({ t, locale, date, monitors }: Digest): string {
	let day = teamDigestDay(date, locale);
	let total = monitors.length;
	let up = countHealthy(monitors);

	if (up === total) {
		return t("emails.teamDigest.daily.summaryAll", { count: total, date: day });
	}

	return t("emails.teamDigest.daily.summary", { up, count: total, date: day });
}
