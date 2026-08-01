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
3. The user's scheduled job calls the ping endpoint after it finishes.
4. The system compares actual pings against the expected schedule.
5. Based on timing, the job is marked healthy, late, missed, or new.

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
- Disabled jobs should not accept pings as if they were active.
- The ping endpoint should be protected against accidental overuse with rate limiting.

## Visible Outputs

- Current status
- Last ping time
- Next expected run time
- Human-readable schedule, in the viewer's language
- Raw cron expression
- Grace period
- Timezone
- Ping history
- Copyable integration examples for common runtimes or shells

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

- Cron jobs need a generated ping URL.
- Expected timing must be derived from cron expression, timezone, and grace period.
- The feature should support both operational dashboards and public-facing status communication.
