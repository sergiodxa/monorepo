# Content Checks

## Purpose

Content checks extend HTTP monitors by validating the response body. They are used when a service can return a technically successful response while still serving the wrong content.

## What Users Configure

- Check type
- Expected text or pattern
- Whether matching is case-sensitive
- Whether the check is enabled

Supported check types:

- `contains`
- `not_contains`
- `regex`

## How It Works

1. A content check is attached to an HTTP monitor.
2. Whenever the HTTP monitor runs, the response body is evaluated against all enabled content checks.
3. Each check produces its own pass or fail result.
4. The overall content-check result only passes if every enabled check passes.

## Matching Rules

- `contains`: the response body must include the configured text
- `not_contains`: the response body must not include the configured text
- `regex`: the response body must match the configured regular expression

## Status Model

- Individual check result: pass or fail
- Overall monitor content result: all checks passed or at least one check failed
- Check state: enabled or disabled

## Empty Response Behavior

- `contains` fails on an empty body
- `regex` fails on an empty body
- `not_contains` passes on an empty body

## Defaults and Limits

- Matching is case-insensitive by default.
- A monitor supports up to `10` content checks.
- Invalid regular expressions must be rejected at creation time.

## Visible Outputs

- List of configured checks per monitor
- Check type
- Stored value or pattern
- Case-sensitivity indicator
- Enabled or disabled state

## Important Behavior Notes

- Content checks are not a separate monitor type. They are part of HTTP monitoring.
- They protect against false positives where the endpoint is reachable but the response is incorrect.
- A reimplementation should make it clear whether content-check failures affect the main HTTP status directly or are shown as a separate validation layer.

## Reimplementation Guidance

Preserve these product rules:

- Content validation must run alongside HTTP checks.
- Multiple checks are combined with logical AND.
- The product must support positive checks, negative checks, and regex checks.
- The feature should remain easy to manage from a monitor detail or edit view.
