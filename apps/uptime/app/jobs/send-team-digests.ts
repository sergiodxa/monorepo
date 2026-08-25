/**
 * Scheduled jobs behind both team digests: for every member of every team owed one, a single
 * email covering that team's monitors over the window their schedule reports.
 * The daily and weekly digests differ only in window length, stamp, and email class; each
 * subclass names its own cron-job monitor, since a monitor watches one schedule. The
 * membership, not the subject, is the unit of delivery, and the per-period stamp on
 * `memberships` keeps a redelivered run from sending the same digest twice.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subject } from "@pkg/auth-sdk";
import type { TFunction } from "@pkg/i18n";

import { AuthSDK } from "@pkg/auth-sdk";
import { subDays, toDayKey } from "@pkg/dates";
import { Job } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { DigestPeriod, DigestRecipient, TeamDigestMonitor } from "~/app/data/team-digest";
import type { TeamDigestMonitor as MonitorReport } from "~/app/emails/shared/team-digest";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";
import type { OptionalEmail, SelectTeam, SelectUserPreferences } from "~/database/schema";

import Team from "~/app/data/team";
import TeamDigest from "~/app/data/team-digest";
import UserPreferences from "~/app/data/user-preferences";
import { emailTranslator } from "~/app/emails/locale";
import { teamDigestDashboardUrl, teamDigestPreferencesUrl } from "~/app/emails/shared/team-digest";
import { TeamDailyDigestEmail } from "~/app/emails/team-daily-digest";
import { TeamWeeklyDigestEmail } from "~/app/emails/team-weekly-digest";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { formatUptime, worstStatus } from "~/app/lib/uptime-report";
import { apportionCostByTeam, recordCost } from "~/app/services/cost";
import { resolveSubjects } from "~/app/services/subjects";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The zone every window and the once-a-day bound are counted in. */
const BOUND_ZONE = "UTC";

/**
 * How many whole UTC days each digest reports, ending yesterday. Whole days only, since
 * `monitor_daily_stats` rows are keyed by UTC calendar day — the finest window either digest
 * can honestly describe; seven for the weekly matches the seven segments its bar draws.
 */
const WINDOW_DAYS: Record<DigestPeriod, number> = { daily: 1, weekly: 7 };

/** Which switch on the account page each period is governed by. */
const PREFERENCE: Record<DigestPeriod, OptionalEmail> = {
	daily: "teamDailyDigest",
	weekly: "teamWeeklyDigest",
};

/**
 * The cron-job monitors each schedule reports itself to, one per trigger since a monitor
 * holds one cron expression: `0 8 * * *` for the daily, `0 9 * * 1` for the weekly. A missing
 * id fails the run's ping, so these are ids of monitors already created in the operator's team.
 */
const DAILY_MONITOR_ID = "03acb710-cd5b-4c8a-8242-c2a2a9dae201";
const WEEKLY_MONITOR_ID = "4715a9ac-7fe6-4423-816c-b4a711b00dda";

/** The days one run reports, resolved once so every team's report covers the same window. */
interface DigestWindow {
	/** Every reported UTC day, oldest first, which fixes the bar's segment order. */
	days: string[];
	since: string;
	/** The last of them, which is always yesterday. */
	until: string;
}

/** Everything one team's members need, resolved once for the whole team. */
interface TeamDigestContext {
	team: SelectTeam;
	/** Its monitors' windows, sorted by name. */
	monitors: MonitorReport[];
	/** The team's own week, one segment per day; only the weekly digest renders it. */
	segments: UptimeBar.Status[];
	/** The team's uptime over the window, already formatted; `null` when nothing was checked. */
	uptime: string | null;
}

/**
 * The sweep both digests run, with the period left to the subclass. Abstract because a
 * cron-job monitor watches one schedule and `Job.run` reads `monitorId` off the class it is
 * given, so the period lives in the type and each subclass names its own schedule's monitor.
 */
abstract class SendTeamDigestsJob extends Job {
	/** Which digest this subclass sends, and therefore which window and which stamp. */
	protected abstract readonly period: DigestPeriod;

	async perform(): Promise<void> {
		let { period } = this;
		let db = getServiceContainer().get(Database);
		let mailer = getServiceContainer().get(Mailer);
		let sdk = getServiceContainer().get(AuthSDK);

		/**
		 * One instant for the whole run, so the window every digest reports, the bound every
		 * membership was selected against, and the stamp each one receives all agree.
		 */
		let now = Date.now();
		let reported = digestWindow(period, now);
		let recipients = await TeamDigest.listDue(db, period, startOfUtcDay(now));

		/**
		 * The opt-out is applied before anything else is loaded, and that ordering is the point:
		 * a member's address comes from the auth server one request at a time, so filtering here
		 * turns a team of ten with two subscribers into just two requests.
		 */
		let preferences = await UserPreferences.findBySubjectIds(
			db,
			recipients.map((recipient) => recipient.subjectId),
		);
		let wanted = recipients.filter((recipient) =>
			UserPreferences.wants(preferences.get(recipient.subjectId) ?? null, PREFERENCE[period]),
		);

		if (wanted.length === 0) {
			this.logger.info("job.send_team_digests.nobody_due", { period, due: recipients.length });
			return;
		}

		let byTeam = groupByTeam(wanted);
		let [teams, profiles] = await Promise.all([
			Team.findByIds(db, [...byTeam.keys()]),
			resolveSubjects(
				sdk,
				wanted.map((recipient) => recipient.subjectId),
			),
		]);

		let settled = await mapWithConcurrency([...byTeam], ([teamId, members]) =>
			this.digestTeam(db, mailer, {
				period,
				window: reported,
				now,
				members,
				team: teams.get(teamId) ?? null,
				profiles,
				preferences,
			}),
		);

		let sent = 0;
		let skipped = 0;
		let errorCount = 0;

		for (let outcome of settled) {
			if (!outcome.ok) {
				errorCount++;
				this.logger.error("job.send_team_digests.team_failed", {
					period,
					teamId: outcome.item[0],
					error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
				});
				continue;
			}

			sent += outcome.value.sent;
			skipped += outcome.value.skipped;
		}

		/**
		 * Split by emails delivered per team (ADR-007 §5): the number of members who wanted the
		 * digest is exactly the share of this run's cost each team caused. Declared after the fact,
		 * since that is when the number is known — the ledger prices it at flush time either way.
		 */
		apportionCostByTeam(
			settled.flatMap((outcome) =>
				outcome.ok ? Array.from({ length: outcome.value.sent }, () => outcome.item[0]) : [],
			),
		);

		this.logger.info("job.send_team_digests.completed", {
			period,
			teams: byTeam.size,
			sent,
			skipped,
			errorCount,
		});
	}

	/**
	 * Builds one team's report and mails it to each of its due members, one after another: the
	 * teams above already run ten at a time, so a second fan-out here would put a hundred sends
	 * in flight at once against a per-invocation subrequest ceiling.
	 *
	 * @returns How many digests went out and how many members were passed over.
	 */
	private async digestTeam(
		db: Database,
		mailer: Mailer,
		run: {
			period: DigestPeriod;
			window: DigestWindow;
			now: number;
			members: DigestRecipient[];
			team: SelectTeam | null;
			profiles: Map<string, Subject>;
			preferences: Map<string, SelectUserPreferences>;
		},
	): Promise<{ sent: number; skipped: number }> {
		let { period, window: reported, now, members, team, profiles, preferences } = run;

		/** A team deleted between the query that selected its members and this read. */
		if (team === null) {
			this.logger.error("job.send_team_digests.team_missing", { teamId: members[0]?.teamId });
			return { sent: 0, skipped: members.length };
		}

		let monitors = await TeamDigest.listMonitors(db, team.id, reported.since, reported.until);

		/**
		 * Nothing was checked, so nothing is reported and no stamp is written, leaving the team
		 * reportable again tomorrow. Covers both a lapsed subscription, which unschedules every
		 * monitor (ADR-005), and a monitor disabled mid-run, which `TeamDigest.listDue`'s `EXISTS` misses.
		 */
		if (monitors.every((monitor) => monitor.days.length === 0)) {
			this.logger.info("job.send_team_digests.nothing_to_report", {
				teamId: team.id,
				period,
				monitors: monitors.length,
			});
			return { sent: 0, skipped: members.length };
		}

		let context: TeamDigestContext = {
			team,
			monitors: monitors.map(toReport),
			segments: teamSegments(monitors, reported.days),
			uptime: teamUptime(monitors),
		};

		let sent = 0;
		let skipped = 0;

		for (let member of members) {
			let profile = profiles.get(member.subjectId);

			/**
			 * No address, no email. The auth server is the only place a member's address lives, so
			 * a profile that failed to resolve is a send this run cannot make — and one it must not
			 * stamp, or the member would silently lose that day's digest.
			 */
			if (!profile) {
				skipped++;
				this.logger.error("job.send_team_digests.profile_missing", {
					teamId: team.id,
					subjectId: member.subjectId,
				});
				continue;
			}

			let { locale, t } = await emailTranslator(
				preferences.get(member.subjectId)?.preferred_language ?? undefined,
			);

			/** Counted before the send, because a rejected send is still a billed one. */
			recordCost("emailSent");
			let result = await mailer.send(
				this.email({ period, context, to: profile.emailAddress, window: reported, locale, t }),
			);

			if (isFailure(result)) {
				skipped++;
				this.logger.error("job.send_team_digests.email_failed", {
					teamId: team.id,
					subjectId: member.subjectId,
					error: result.error.message,
				});
				continue;
			}

			/** Only now: the stamp is what keeps a redelivered trigger from sending a second copy. */
			await TeamDigest.markSent(db, member.id, period, now);
			sent++;
		}

		return { sent, skipped };
	}

	/** The email one member gets, which is the only place the two periods produce different mail. */
	private email(send: {
		period: DigestPeriod;
		context: TeamDigestContext;
		to: string;
		window: DigestWindow;
		locale: string;
		t: TFunction;
	}) {
		let { period, context, to, window: reported, locale, t } = send;
		let { team, monitors, segments, uptime } = context;

		let shared = {
			to,
			teamName: team.name,
			monitors,
			dashboardUrl: teamDigestDashboardUrl(team.slug),
			preferencesUrl: teamDigestPreferencesUrl(team.slug),
			locale,
			t,
		};

		if (period === "daily") return new TeamDailyDigestEmail({ ...shared, date: reported.until });

		return new TeamWeeklyDigestEmail({
			...shared,
			since: reported.since,
			until: reported.until,
			segments,
			uptime,
		});
	}
}

/**
 * The 08:00 UTC run: yesterday, for every team.
 *
 * @example waitUntil(SendTeamDailyDigestsJob.run({ message, uptime }));
 */
export class SendTeamDailyDigestsJob extends SendTeamDigestsJob {
	/** The "Team Daily Digest" cron monitor this run reports itself to when it completes. */
	static override monitorId = DAILY_MONITOR_ID;

	protected override readonly period = "daily" as const;
}

/**
 * The Monday 09:00 UTC run: the seven days that just ended.
 *
 * Its own class, so it reports to its own cron-job monitor — see {@link SendTeamDigestsJob}.
 *
 * @example waitUntil(SendTeamWeeklyDigestsJob.run({ message, uptime }));
 */
export class SendTeamWeeklyDigestsJob extends SendTeamDigestsJob {
	/** The "Team Weekly Digest" cron monitor this run reports itself to when it completes. */
	static override monitorId = WEEKLY_MONITOR_ID;

	protected override readonly period = "weekly" as const;
}

/** Midnight UTC on the day `now` falls in, which is the once-a-day bound as an instant. */
function startOfUtcDay(now: number): number {
	let date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * The UTC days one period reports, oldest first and ending yesterday. Yesterday and not
 * today, since the roll-up runs once, at 01:00, for the day that just closed — a window
 * reaching into today would report a day with no row at all as a gap in the bar.
 *
 * @param period - Which digest is being sent.
 * @param now - The run's single instant.
 * @returns The window, as the days it covers and its two ends.
 */
function digestWindow(period: DigestPeriod, now: number): DigestWindow {
	let yesterday = new Date(now - MS_PER_DAY);
	let count = WINDOW_DAYS[period];
	let days = Array.from({ length: count }, (_, index) =>
		toDayKey(subDays(yesterday, count - 1 - index), BOUND_ZONE),
	);

	return {
		days,
		since: toDayKey(subDays(yesterday, count - 1), BOUND_ZONE),
		until: toDayKey(yesterday, BOUND_ZONE),
	};
}

/** Groups the due memberships by the team each one's digest is about, keeping their order. */
function groupByTeam(recipients: DigestRecipient[]): Map<string, DigestRecipient[]> {
	let byTeam = new Map<string, DigestRecipient[]>();

	for (let recipient of recipients) {
		let members = byTeam.get(recipient.teamId);
		if (!members) byTeam.set(recipient.teamId, (members = []));
		members.push(recipient);
	}

	return byTeam;
}

/**
 * One monitor's window as its row in the email: where it ended up, and its uptime. Status
 * is the worst day it had, since the row is a verdict on the whole window. Uptime sums
 * checks across the window's days, so a busier day counts for more; `null` means unmeasured.
 */
function toReport(monitor: TeamDigestMonitor): MonitorReport {
	let checks = 0;
	let successful = 0;
	let status: UptimeBar.Status = null;

	for (let day of monitor.days) {
		checks += day.totalChecks;
		successful += day.successfulChecks;
		status = worstStatus(status, day.status);
	}

	return {
		id: monitor.id,
		name: monitor.name,
		type: monitor.type,
		status,
		uptime: checks === 0 ? null : formatUptime(successful / checks),
	};
}

/**
 * The team's window as one bar: per day, the worst status any of its monitors reported, and
 * `null` for a day none of them was checked on. The worst wins for the same reason it does
 * inside a single monitor's day, so the segments answer which days were bad for the team.
 *
 * @param monitors - The team's monitors with their days.
 * @param days - The window's days, oldest first, which fixes the segments' order.
 * @returns One segment per day.
 */
function teamSegments(monitors: TeamDigestMonitor[], days: string[]): UptimeBar.Status[] {
	let byDate = new Map<string, UptimeBar.Status>();

	for (let monitor of monitors) {
		for (let day of monitor.days) {
			byDate.set(day.date, worstStatus(byDate.get(day.date) ?? null, day.status));
		}
	}

	return days.map((date) => byDate.get(date) ?? null);
}

/**
 * The team's uptime over the window: every check every monitor ran, and how many passed.
 * Summed by check and not by monitor, since that matches the dashboard's own figure and
 * keeps a monitor checked once an hour from counting as much as one checked every minute.
 *
 * @param monitors - The team's monitors with their days.
 * @returns The formatted percentage, or `null` when nothing was checked at all.
 */
function teamUptime(monitors: TeamDigestMonitor[]): string | null {
	let checks = 0;
	let successful = 0;

	for (let monitor of monitors) {
		for (let day of monitor.days) {
			checks += day.totalChecks;
			successful += day.successfulChecks;
		}
	}

	return checks === 0 ? null : formatUptime(successful / checks);
}
