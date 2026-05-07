# DNS Monitors

## Purpose

DNS monitors verify that a domain resolves correctly and, when needed, that the resolved value matches a specific expected value.

## What Users Configure

- Name
- Domain
- DNS record type
- Expected value, optional
- Check interval
- Enabled or disabled state

Supported record types:

- `A`
- `AAAA`
- `CNAME`
- `MX`
- `TXT`
- `NS`

## How It Works

1. The user defines a domain and record type.
2. The system performs recurring DNS lookups.
3. If an expected value is configured, the resolved value is compared against that value.
4. If no expected value is configured, the monitor behaves like change detection and flags when the value changes from the prior known result.

## Status Model

- `ok`: the DNS result matches expectations or has not changed unexpectedly
- `changed`: the result differs from the expected or previously known value
- `error`: the lookup failed or could not be completed
- `not checked`: no result exists yet

## Result Handling Rules

- Multiple resolved values should be normalized before comparison.
- TXT values should be normalized so formatting differences do not create false alarms.
- The first successful check becomes the baseline when no explicit expected value is provided.

## Scheduling Rules

- DNS monitoring is designed around less frequent checks than HTTP monitoring.
- The default interval is `3600` seconds.
- Product behavior is centered on hourly checks.

## Visible Outputs

- Current status
- Last checked time
- Last resolved value
- Result history
- Success rate
- Average response time
- Total checks
- Manual check trigger from the detail view

## Defaults and Limits

- Default interval is `3600` seconds.
- DNS monitors are enabled by default.
- The product uses a team-level limit of `20` DNS monitors.

## Important Behavior Notes

- DNS monitoring supports both expectation-based validation and passive change detection.
- A changed record is not the same as a failed lookup. The distinction matters for alerts and status communication.
- The feature is best treated as configuration monitoring, not service-availability monitoring.

## Reimplementation Guidance

Preserve these product rules:

- Users must be able to monitor either exact expected values or unexpected changes.
- DNS-specific statuses should stay distinct from HTTP statuses.
- Historical value tracking matters because changes are often more important than one isolated result.
