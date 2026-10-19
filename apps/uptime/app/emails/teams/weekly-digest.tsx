/**
 * One team's last seven days, in one email, to one of its members: the week as a bar, how
 * many monitors got through it clean, then every monitor as a row with its own week. Each bar
 * segment is the worst status any monitor reported that day, so a monitor that failed and
 * recovered still shows as the day it failed (ADR-024).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailInput, EmailPropsOutput } from "@sdxc/mail";

import { createEmail, Email } from "@sdxc/mail";

import type { UptimeBar as UptimeBarTypes } from "~/app/emails/shared/uptime-bar";

import emails from "~/app/emails";
import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TeamDigestFooter,
	TeamDigestMonitorList,
	countHealthy,
	sortTeamDigestMonitors,
	teamDigestDay,
	TEAM_DIGEST_MAILING_LISTS,
} from "~/app/emails/shared/team-digest";
import { UptimeBar } from "~/app/emails/shared/uptime-bar";

/** What every member of the template reads: the team's week, the reader's locale and `t`. */
type Digest = EmailInput<EmailPropsOutput<typeof emails.teams.weeklyDigest>>;

export default createEmail(emails.teams.weeklyDigest, {
	/** Two keys, and a `count` on each, for the same reasons the daily digest has both. */
	subject: ({ t, teamName, monitors }) => {
		let total = monitors.length;
		let up = countHealthy(monitors);

		if (up === total) {
			return t("emails.teamDigest.weekly.subjectAll", { team: teamName, count: total });
		}

		return t("emails.teamDigest.weekly.subject", { team: teamName, up, count: total });
	},
	unsubscribe: ({ unsubscribeUrl }) => ({ url: unsubscribeUrl }),
	/** This digest's own list, so unsubscribing from it leaves the other digest on. */
	list: () => TEAM_DIGEST_MAILING_LISTS.weekly,
	body: (handle) => () => {
		let { t, locale, teamName, segments, monitors, dashboardUrl, preferencesUrl } = handle.props;
		let heading = t("emails.teamDigest.weekly.heading", { team: teamName });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.teamDigest.weekly.preview", { team: teamName })}
				darkStyles={DARK_STYLES}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>{summary(handle.props)}</Email.Text>
				<UptimeBar segments={segments} labels={labels(handle.props)} />
				<TeamDigestMonitorList monitors={sortTeamDigestMonitors(monitors)} t={t} />
				<Email.Button href={dashboardUrl}>{t("emails.teamDigest.action")}</Email.Button>
				<Email.Footer>
					<TeamDigestFooter teamName={teamName} preferencesUrl={preferencesUrl} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		teamName: "Acme",
		since: "2026-07-27",
		until: "2026-08-02",
		segments: ["up", "up", "degraded", "up", "down", "up", null],
		uptime: "99.2",
		monitors: [
			{ id: "website", name: "Website", type: "http", status: "up", uptime: "100" },
			{ id: "api", name: "API", type: "http", status: "down", uptime: "97.1" },
		],
		dashboardUrl: "https://uptime.sergiodxa.com/acme",
		preferencesUrl: "https://uptime.sergiodxa.com/acme/account#emails",
		unsubscribeUrl: "https://uptime.sergiodxa.com/digests/unsubscribe/preview",
	}),
});

/** The roll-up line, worded as "all of them" when the whole week was clean. */
function summary({ t, monitors }: Digest): string {
	let total = monitors.length;
	let up = countHealthy(monitors);

	if (up === total) return t("emails.teamDigest.weekly.summaryAll", { count: total });
	return t("emails.teamDigest.weekly.summary", { up, count: total });
}

/**
 * The bar's captions: the two ends of the window as dates rather than as "7 days ago", since
 * the window is a fixed range of whole days and naming it exactly costs nothing.
 */
function labels({ t, locale, since, until, uptime }: Digest): UptimeBarTypes.Labels {
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
