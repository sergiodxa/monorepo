# TCP Monitors

## Purpose

TCP monitors check whether a server accepts a raw TCP connection on a specific host and port. They are useful for infrastructure and service-level monitoring when HTTP is not the right protocol.

## What Users Configure

- Name
- Host
- Port
- Timeout
- Check interval
- Enabled or disabled state

## How It Works

1. The user defines a host and port.
2. The system attempts a TCP connection on a recurring schedule.
3. If the connection succeeds, the service is up.
4. If the connection is refused or fails immediately, the service is down.
5. If the connection does not complete within the timeout, the result is timeout.

## Status Model

- `up`: connection succeeded
- `down`: connection failed
- `timeout`: the target did not respond in time
- `pending`: no result yet
- `disabled`: the monitor is not active

## Scheduling Rules

- TCP monitoring is designed to run less frequently than HTTP monitoring.
- The product uses a default interval of `60` seconds in the data model, with `5` minutes as a common UI default.
- The default timeout is `5000` ms.

## Visible Outputs

- Current status
- Last checked time
- Last response time
- Uptime percentage
- Average response time
- Total checks
- Result history
- Error messages for failed checks

## Defaults and Limits

- Port range should support `1` through `65535`.
- Timeout should support at least `100` through `60000` ms.
- Interval should support `60` through `86400` seconds. The floor is 60 because that is the
  finest cadence the scheduler can deliver, so a shorter interval could be configured and
  billed for but never actually run.
- Monitors are enabled by default.

## Important Behavior Notes

- TCP monitoring is binary infrastructure monitoring, but it still benefits from distinguishing timeout from immediate failure.
- Timeout should generally be treated as a non-healthy state.
- The product expects transition-based alerting rather than repeated alerts for every failed check.

## Reimplementation Guidance

Preserve these product rules:

- TCP monitoring must remain protocol-agnostic and separate from HTTP assumptions.
- Users need host, port, timeout, and interval controls.
- The feature should expose raw connectivity health clearly, including timeout as its own outcome.
