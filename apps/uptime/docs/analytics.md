# Analytics

## Purpose

Analytics turn raw monitoring results into readable operational trends. They help users understand uptime, latency, reliability, and incidents over time.

## What The Feature Shows

- Team uptime summaries
- Monitor uptime percentages
- Average response times
- Slowest services
- Historical failure patterns
- Long-term health heatmaps
- Daily aggregate status summaries

## How It Works

1. Every monitor check produces a result.
2. Recent results power near-real-time dashboards.
3. Older results are aggregated into daily summaries for long-term reporting.
4. Teams and individual monitors can both display historical performance.

## Time Horizons

- Recent operational views focus on roughly the last 24 hours.
- Long-term reporting uses daily aggregates.
- Long-range history is intended to support year-long views such as 365-day heatmaps.

## Metrics

- Uptime percentage
- Total checks
- Successful checks
- Failed checks
- Average response time
- Maximum response time
- Percentile-style latency metrics when available
- Daily overall status: `up`, `degraded`, or `down`

## Status Model

Daily aggregates classify a service as:

- `up`
- `degraded`
- `down`

These summaries are derived from many individual checks rather than one isolated result.

## Visible Outputs

- Dashboard summary cards
- Per-monitor detail metrics
- Long-term calendars or heatmaps
- Incident-oriented historical views
- Performance trend visualizations

## Important Behavior Notes

- Analytics is mostly read-only from the user perspective.
- It depends on consistent result collection across monitor types.
- A reimplementation should define clearly which monitor types participate in long-term aggregation and which only appear in short-term views.

## Reimplementation Guidance

Preserve these product rules:

- Raw checks and aggregated reporting should both exist.
- Users need both recent operational visibility and long-term historical visibility.
- Analytics should power dashboards, monitor detail pages, and public communication features where appropriate.
