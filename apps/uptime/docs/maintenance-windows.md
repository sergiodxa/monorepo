# Maintenance Windows

## Purpose

Maintenance windows mark planned downtime so teams can avoid false alarms and communicate planned work separately from unplanned incidents.

## What Users Configure

- Name
- Scope: every monitor, every monitor of one type, or a single monitor of any type
- Start time
- End time or duration
- Whether alerts are suppressed during maintenance
- Whether maintenance should be shown on status pages
- Whether the window recurs
- Recurrence pattern when recurring

## How It Works

1. The user creates a maintenance window.
2. The window applies to one monitor, one kind of monitor, or the whole team.
3. While active, the maintenance window can suppress alerts.
4. The window remains visible as planned maintenance rather than an outage event.
5. An active maintenance window can be ended early.

## Status Model

- `upcoming`
- `active`
- `past`

## Scope Rules

- A window may target a specific monitor, of any monitor type.
- A window may target every monitor of one type, including ones created later.
- A window may also apply to all monitors in a team, which is the default.
- Monitor-scoped maintenance should affect only the selected service, and type-scoped
  maintenance only that type — a window covering an HTTP monitor never quiets a DNS check
  that happens to share its id.
- A scope naming a monitor the team does not own is a validation failure. It must never be
  read as "all monitors": widening a window silences everything the team runs.

## Scheduling and Recurrence

Supported maintenance patterns include:

- One-time maintenance with fixed start and end times
- Daily recurring maintenance
- Weekly recurring maintenance
- Monthly recurring maintenance

Recurring maintenance should still behave like an active window when its current occurrence is in effect.

## Visible Outputs

- Maintenance name
- Scheduled time range
- Scope
- Active, upcoming, or past label
- Recurring indicator when applicable

## Defaults and Limits

- Alert suppression defaults to enabled.
- Status-page visibility defaults to enabled.
- End time must be after start time.

## Important Behavior Notes

- Maintenance is not an outage. The product should present it as planned work.
- Suppressing alerts is one of the core reasons this feature exists.
- Status-page visibility is also part of the feature concept, even if a future implementation chooses a different visual treatment.

## Reimplementation Guidance

Preserve these product rules:

- Maintenance must support both operational suppression and customer communication.
- It should be possible to target one service, one kind of service, or all services.
- Recurring maintenance should be a first-class concept, not a manual duplication workaround.
