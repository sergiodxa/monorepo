# HTTP Monitors

## Purpose

HTTP monitors watch websites and APIs for availability and performance. A monitor makes recurring HTTP requests to a target URL and decides whether the service is healthy, degraded, or down.

## What Users Configure

- Name
- Target URL
- HTTP method
- Expected HTTP status code
- Check interval
- Request timeout
- Degraded threshold in milliseconds
- Preferred check region or location hint
- Whether SSL monitoring is enabled for the endpoint
- SSL expiry warning threshold in days

## How It Works

1. The user creates a monitor for a URL.
2. The system checks that URL on a schedule.
3. Each check records whether the response matched the expected status.
4. The system also measures response time.
5. If the response matches the expected status and is fast enough, the monitor is healthy.
6. If the response matches the expected status but is slower than the degraded threshold, the monitor is degraded.
7. If the response does not match the expected status, times out, or cannot be completed, the monitor is down.

Newly created monitors are intended to start checking right away rather than waiting for the next long interval.

## Status Model

- `up`: the endpoint responded as expected and within the acceptable performance threshold
- `degraded`: the endpoint responded successfully but too slowly
- `down`: the endpoint failed, timed out, or returned an unexpected status
- `pending` or `unknown`: there is not enough data yet to determine a status
- `disabled`: the monitor exists but is not actively checking

## Scheduling Rules

- HTTP monitoring runs continuously on a recurring schedule.
- Each monitor has its own interval setting.
- The product is designed around short intervals, with one-minute monitoring as the baseline.
- Short-term dashboards focus on recent behavior, while long-term views use daily aggregates.

## Visible Outputs

- Current status
- Last check time
- Latest response time
- Historical results
- Uptime percentage
- Recent incidents or failures
- Heatmap-style long-term history
- Slowest response summaries on team dashboards

## Defaults and Limits

- Expected status defaults to `200`.
- Timeout defaults to `10` seconds.
- Degraded threshold defaults to `5000` ms.
- SSL warning defaults to `30` days.
- The platform is designed around intervals from about `60` seconds to `3600` seconds.

## Important Behavior Notes

- A degraded response is different from downtime. The service is reachable, but slower than the configured threshold.
- The same endpoint can participate in alerting, status pages, analytics, and SSL expiry tracking.
- Some product surfaces emphasize the difference between degraded and down more clearly than others, so the reimplementation should define that presentation consistently.

## Reimplementation Guidance

Preserve these product rules:

- Status is based on both correctness and speed.
- A monitor needs configurable expectations, not only a URL.
- Each check should produce historical data that can power both incident views and long-term analytics.
- HTTP monitors are the primary source for uptime and latency reporting across the product.
