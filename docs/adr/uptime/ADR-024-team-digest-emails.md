# ADR-024: Daily and Weekly Monitor Digests for a Team's Members

## Status

**Accepted** — implemented 2026-08-03. The email contract is
[ADR-030](../ADR-030-email-classes-as-the-authoring-contract.md); the data these read is written
by the roll-up described in [ADR-001](./ADR-001-analytics-engine-migration.md) and
`apps/uptime/docs/analytics.md`.

## Context

Every email this app sends a customer today is a reaction to something: an invite because
somebody was invited, an alert because a monitor changed state. Between those, a team with
healthy monitors hears nothing at all, and the only way to learn that the week went well is to
open the dashboard and look.

The public trial already has the opposite habit. A visitor who leaves a URL gets a daily digest
and a seven-day wrap-up, because a lead has no dashboard and the email has to be the whole
product. Those two emails are the shape a paying team is missing, and the reason they cannot
simply be pointed at a team is that almost every decision inside them is a decision about
somebody without an account:

| The trial digests assume         | A team's members are                                             |
| -------------------------------- | ---------------------------------------------------------------- |
| One reader per address           | One reader per **membership** — a person can be in several teams |
| One URL, HTTP only               | Four monitor types, any number of them                           |
| No dashboard                     | A dashboard, one click away                                      |
| No account, so a token opts out  | An account with a settings page                                  |
| Hourly rows for a 24-segment bar | Rows a retention sweep deletes after seven days                  |

## Decision

Send two digests — one daily, one weekly — to every member of every team, from one job, off the
daily roll-up, with a per-person switch for each on the account page.

### 1. The unit is the membership, not the person and not the team

A member of three teams gets three emails. A monitor list is only readable next to the name of
the team that owns it, and merging three teams into one message would make every row ambiguous
about which dashboard it belongs to — so the team's name is in the subject as well as the body,
because the inbox is where a reader in several teams decides which one this is about.

That choice settles where the schedule lives: `memberships.last_daily_digest_at` and
`memberships.last_weekly_digest_at`. A stamp on the subject would suppress two of the three
emails, and a stamp on the team would suppress every member but the first.

### 2. Both windows are read from `monitor_daily_stats`

`AggregateDailyStatsJob` already reduces every monitor's day to one row — for HTTP out of
Analytics Engine, for DNS, TCP and cron jobs out of their own tables — so a digest is a range
scan over that one table whatever window it covers, and reports the same numbers the dashboard's
heatmap does.

The alternative is re-deriving each window from the sources, which is worse three times over: an
Analytics Engine query plus three D1 scans per team instead of one query; a seven-day window that
reaches past the seven-day retention on `monitor_results` (ADR-020); and two code paths that can
disagree with the heatmap about the same day.

Two consequences follow and both are accepted. The window is whole UTC days ending **yesterday**,
never a rolling one — a rolling window would need rows nothing writes. And both triggers must run
after the 01:00 roll-up, which they do: 08:00 daily, and 09:00 on Mondays for the weekly.

### 3. One sweep, two scheduled jobs

The two digests differ in three things — how many days they read, which stamp they honour, which
email class they construct — and agree on everything else: who is owed one, how an address and a
language are resolved, how rows become a report, and what a failed send does. All of that lives
once, on an abstract `SendTeamDigestsJob`.

What the two subclasses add is a period and a **cron-job monitor**, and the monitor is the reason
they are subclasses rather than one class reading its period from the message — which is how this
shipped, and was wrong. A monitor watches one schedule: it holds a single cron expression and
reports a run late against it. `Job.run` reads `monitorId` off the class it was handed, so one
class could only ever ping one of the two monitors, leaving the other digest to fail unwatched —
and the weekly digest is the one whose silence lasts longest, since `missed` means the _following_
run also failed to arrive, a week later.

Two schedules that fail independently are two things to watch, so the split is not a workaround
for the jobs package's shape; it is the shape being right. The alternative considered and rejected
was making `monitorId` a runtime value in `@pkg/jobs`: it would not have reduced the work, because
two monitors are needed either way and the class would then carry a period-to-monitor lookup
instead of the type system carrying it, and it would have made "which monitor does this job report
to" unanswerable by reading the class across the three apps and twenty job classes that package
serves.

The two emails stay two classes for their own reason: `app/emails/` is the inventory of what this
app can send, and each switch on the settings page names one of them.

### 4. A digest names what to look at; the dashboard holds the detail

Both emails are a roll-up sentence plus one row per monitor — name, status over the window,
uptime — ordered worst first, then a link to the dashboard. No per-monitor bars, no response
times, no per-check detail.

This is the deliberate opposite of the trial digests, and the reason is the reader: they have
somewhere better to look. A twenty-monitor team would otherwise get a twenty-section email nobody
reads to the end, and the one thing a digest is uniquely able to do — be read from a
notification without being opened — is done by putting the whole result in the subject instead.

The weekly digest earns its place on top of the daily with the one thing no single day can show:
a seven-segment bar of the **team's** week, each segment the worst status any of its monitors
reported that day. A monitor that failed on Tuesday and recovered reads "up" in every daily
digest after it; the bar is where that Tuesday is still visible. One bar per monitor was rejected
for the same reason as per-monitor detail — a hundred and forty segments for a twenty-monitor
team, answering a question the row underneath already answers.

Statuses fold with the worst-wins rule everywhere: inside a monitor's day, across a monitor's
week, and across the team's day. A summary that averaged an outage away would hide the only thing
in it a reader could act on.

### 5. The switch is per person, and stored as refusals

`user_preferences.unsubscribed_emails` holds the list of optional emails a subject has turned
**off**; the value set is `optionalEmails` in `database/schema.ts`, next to the column.

- **Per person, not per team.** The setting is on the account page, so somebody in three teams
  turns the daily digest off once and it stops for all three. A team-scoped switch would be a
  different promise than the page it sits on makes.
- **Refusals, not acceptances.** Both store the same information, and the difference shows when a
  third digest is added: a stored opt-out list needs no migration, no column, and no backfill —
  the new email is on for everybody the moment it ships, because the default is the absence of
  data. It also means a member who has never opened the page needs no row at all.
- **A list, not a boolean per email.** The settings page renders one switch per entry in
  `optionalEmails`, so adding an email is one entry plus its copy, not a schema change and four
  edits.
- Only optional mail is in the set. An invite and an alert are each the answer to something
  somebody did; a digest nobody asked for by name is not.

Unknown strings in a stored list are ignored on read, which is what makes retiring an email safe.

### 6. Unsubscribing goes to the settings page

Every digest carries `List-Unsubscribe` pointing at
`/app/:team/account#emails`, and a footer link to the same place. Deliberately **no**
`List-Unsubscribe-Post`: RFC 8058 one-click means the client `POST`s a URL with no session and no
chance to ask anything, and this setting is not one email but a list of them, chosen per account
across every team. The trial emails do carry one-click, because there the choice genuinely is
binary and the reader has no account to sign in to.

The fragment is a shared constant (`EMAIL_PREFERENCES_ANCHOR`) rather than two literals, so
renaming the section cannot leave the link landing at the top of a page whose switches are three
sections down.

### 7. Idempotence is the stamp; the cron is the cadence

`TeamDigest.listDue` selects only memberships whose stamp predates **today's UTC midnight**, and
`markSent` moves it — so a cron trigger delivered twice, or a queue message redelivered after a
failure, finds the work already done. The stamp is written only after a send the transport
accepted: a digest that failed to render or deliver leaves that membership due and the next
delivery retries it.

Note what the stamp does not do: it does not make the weekly digest weekly. The cron expression
does. The stamp's only job is to stop a second copy on the same day, which is why both periods
share one bound instead of the weekly counting seven days of its own.

### 8. What is not sent

- A team with no enabled monitors. `listDue` requires one via `EXISTS`, so those members cost not
  even the request that would resolve their address.
- A disabled monitor's row. Nothing checks it, so every day of it is a gap, and a permanent row of
  "not checked" is noise a reader has to learn to ignore every morning.
- A member whose profile the auth server cannot resolve. Addresses live only there, so there is no
  send to make — and no stamp to write, or they would silently lose the day.
- A team where **nothing was checked** in the window. This is what a lapsed subscription looks
  like: revoking it unschedules every monitor the team owns (ADR-005), so no checks run and every
  row of the digest would read "not checked" — every morning, indefinitely. A digest reports on
  monitoring that happened, and the dashboard's own paused-monitors banner is the honest place to
  say that none did.

Nothing here reads Polar or the subscription projection. "Was anything checked" is the same
question one step closer to what the email is about, and it needs no join to billing.

## Consequences

- Two new cron triggers, `0 8 * * *` and `0 9 * * 1`, each with a cron-job monitor of its own in
  the operator's team, pinged on completion like every other scheduled job here. Both carry a
  15-minute grace period rather than the 5-minute default — the ping lands after the whole sweep,
  which is a queue hop plus a request per subscribed member plus a send each — and both alert on
  `late` rather than waiting for `missed`, which for the weekly would be a week away. Each takes
  its own hour so a failure in the
  SSL sweep, the trial digests or the funnel report cannot delay mail going to paying customers.
- Both digests are **on by default**, for existing members as well as new ones — that is what
  storing refusals means. Every member of a team with monitors starts receiving one email a day
  and one a week until they say otherwise.
- One address lookup per distinct subscribed member per run, against the auth server, in bounded
  batches (ADR-008). `resolveSubjects` now de-duplicates and bounds its fan-out, which it did not
  before.
- One `UPDATE` per delivered digest. The stamps are deliberately unindexed: the job reads every
  membership on purpose, so an index would be a written row per member per day that no query
  reads.
- The run's cost is split by digests delivered per team (ADR-007 §5), declared after the sends
  because that is when the number is known.
- `formatUptime` and the worst-wins rule moved to `app/lib/uptime-report.ts`, and the email
  colour literals to `app/emails/shared/palette.ts`, so the trial reports, the team digests and
  the bar cannot drift apart on either.
