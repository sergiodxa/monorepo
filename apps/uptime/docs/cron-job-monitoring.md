# Cron Job Monitoring

## Purpose

Cron job monitoring verifies that scheduled jobs run on time by requiring the job to send a ping after each successful execution.

## What Users Configure

- Name
- Description
- Cron expression
- Timezone
- Grace period
- Whether to alert when the job is late
- Enabled or disabled state

## How It Works

1. The user creates a cron job monitor.
2. The system provides a unique ping endpoint for that monitor.
3. The user creates an API key carrying the cron ping permission, and gives it to the job.
4. The user's scheduled job calls the ping endpoint after it finishes, presenting that key.
5. The system compares actual pings against the expected schedule.
6. Based on timing, the job is marked healthy, late, missed, or new.

## Status Model

- `healthy`: recent pings are arriving on time
- `late`: the job has not arrived yet, but it is still within a recoverable delay window
- `missed`: the job did not arrive in time
- `new`: the monitor is configured but not established yet

Ping history also tracks whether each individual ping was on time.

## Scheduling Rules

- The cron expression and timezone define when runs are expected.
- Only the five standard fields are accepted: a seconds field, and the non-standard `L`, `W`, `#` and `?` extensions, are rejected with a reason the form can explain.
- A submitted expression is stored normalized (macros expanded, names resolved to numbers), so one schedule has one spelling.
- The grace period defines how much lateness is tolerated.
- If alert-on-late is disabled, the job may still become late, but notifications wait until it becomes missed.

## Ping Rules

- Jobs are expected to ping after successful completion.
- A ping must present an API key carrying the cron ping permission. That permission is separate from cron read and write so a key handed to a scheduled job can record pings and nothing else.
- A key reaches only the monitors of the team that owns it.
- A monitor the caller's team does not own is answered exactly as an unknown one is, so the endpoint cannot be used to learn which monitor identifiers exist. Telling the two apart would hand an authenticated caller a way to enumerate other teams' monitors.
- Disabled jobs should not accept pings as if they were active.
- The ping endpoint should be protected against accidental overuse with rate limiting: one accepted ping per minute per monitor as a product rule, and a per-caller budget as an abuse rule.
- The abuse budget is spent before the key is checked, so a flood is refused without the system looking up whatever key it presented. A caller past its budget is told it is rate limited, not that it is unauthenticated.
- Only an accepted ping is billable. A ping refused before it is recorded — unauthenticated, unpermitted, unknown, disabled, too frequent, or over budget — performed no work and must not be metered.

### Why Pings Are Authenticated

The endpoint was originally open, with the monitor identifier in the URL acting as the only secret. That is the conventional model for cron monitoring, and it buys a real thing: the integration is a bare shell command with no header and no key to distribute.

It was given up because a URL is a poor secret. It leaks into continuous integration logs, shell history, shared crontabs and screenshots, and once leaked there is nothing to revoke short of deleting the monitor and losing its history. A permission-scoped key can be rotated on its own, and can be granted to a job without granting anything else.

The cost is accepted knowingly and is not softened: every job pinging the endpoint has to carry a key, and one that does not is rejected and will eventually alert as missed. There is no grace period and no unauthenticated fallback.

## Visible Outputs

- Current status
- Last ping time
- Next expected run time
- Human-readable schedule, in the viewer's language
- Raw cron expression
- Grace period
- Timezone
- Ping history
- Copyable integration examples for common runtimes or shells, each carrying the authorization header a ping needs and reading the key from the environment rather than inlining it

## Defaults and Limits

- Default timezone is `UTC`.
- Default grace period is `300` seconds.
- Alert-on-late defaults to `false`.
- Cron job monitors are enabled by default.

## Important Behavior Notes

- Cron monitoring is success-reporting, not process-inspection. The system knows a job ran because the job reports it.
- Late and missed are different operational states and should remain distinct.
- The feature should work well both for background jobs and for scheduled workflows.

## Reimplementation Guidance

Preserve these product rules:

- Cron jobs need a generated ping URL, and that URL is an address, not a credential.
- Pings must require a permission distinct from cron read and write, scoped to the owning team, and revocable without touching the monitor.
- An unowned monitor and an unknown monitor must be answered identically.
- Expected timing must be derived from cron expression, timezone, and grace period.
- The feature should support both operational dashboards and public-facing status communication.
