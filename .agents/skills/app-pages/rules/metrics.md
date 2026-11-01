---
title: Metrics Live Inside Interaction
impact: HIGH
tags: [dashboard, stat-card, chart, sparkline, status-strip, range]
---

# Metrics Live Inside Interaction

A dashboard number on its own asks "is that good?". Each metric should answer that question itself
and lead somewhere: the chart behind it, the records that moved it.

## Stat cards

- Muted label, the value at 24–30px semibold in `tabular-nums`, a delta pill with its comparison
  ("+0.02% vs last week"), and a footer sentence that explains the number ("2 monitors down since
  09:14").
- Set the delta tone by meaning, not sign: latency going up is bad.
- For a row of related numbers, ruled columns (1px rules, no boxes) read calmer than four cards.
- When stats sit above a chart, make them the chart's tabs: picking "p95 latency" switches the chart.
- Skeletons match the card's real height, so the stream-in doesn't shift the page.

## Charts

- The range picker drives every chart on the screen and lives in the URL (24h · 7d · 30d · 90d, each
  with a letter key; custom opens a date range). In a narrow container it becomes a select.
- Show the comparison period on the same chart, muted and dashed. Mark incidents and deploys as bands,
  thresholds as lines.
- **Hatch periods with no data.** A zero bar says "nothing happened"; a hatched bar says "we don't
  know". They are different claims.
- The headline value follows the hovered point when the chart is the metric.

## Metrics in rows

- A per-row sparkline with a one-word state ("Stable", "Degrading", "Down") lets a list carry its trend
  (Sentry). The word does the reading; the line confirms it.
- A status strip (90 days of uptime bars) tints each period by status, hatches unknown periods, and
  shows a tooltip per bar by keyboard too.

## Rules

1. Every number gets a comparison or a sentence.
2. One range picker per screen, in the URL.
3. Hatch missing data; never draw it as zero.
4. Use `StatCard`, `Sparkline`, `StatusStrip`, `RangePicker` and `Chart`; never hand-roll SVG in an app.
