---
title: Reports
description: Download uptime reports as CSV for a month, a quarter or any range of days, to keep or to send to a client.
section:
  title: Concepts
  order: 2
order: 10
lastUpdated: 2026-09-29
---

Reports turn your monitors' history into a file you can open in a spreadsheet, keep with your records, or send to the client whose services you monitor. Open **Reports** in the sidebar, choose a range, the monitors and a format, and download.

## The Two Reports

### Uptime summary

One row per monitor for the whole range, with its checks, uptime percentage, average and maximum response time, the number of days it was down or degraded, and the minutes of maintenance that covered it.

### Daily uptime

One row per monitor for each day in the range, with that day's checks, uptime percentage, response times, status and maintenance minutes. Use it to chart a month or to find the day something went wrong.

## Choosing What a Report Covers

### Range

A report covers whole days, from the first date to the last one, both included, for up to 366 days. Days are UTC, the same days the dashboard's uptime bars show. The latest day a report can include is yesterday, because today's checks are still coming in.

The quick ranges fill in the dates for you:

- **Last month** — the previous calendar month, the range a report opens with
- **Last 30 days** — the thirty days ending yesterday
- **Last quarter** — the last full calendar quarter
- **Year to date** — from 1 January to yesterday

### Monitors

A report covers every monitor in the team, the monitors attached to one status page, or every monitor of one type. If you keep a status page per client, choosing that page gives you a report with that client's monitors only.

Reports list the team's current monitors, including paused ones, which report the days they ran.

## Formats

### Spreadsheet

Opens directly in Excel, Numbers or Google Sheets. Column names, monitor types and statuses are in your language, and numbers use your language's decimal mark. In languages that write decimals with a comma, such as Spanish, German, French and Italian, the file separates columns with semicolons, which is what Excel expects in those languages.

### Standard CSV

Comma-separated, with fixed column names such as `uptime_percent`, and dot decimals, whatever your language. Choose it for scripts, imports into other tools, or anything that reads the file by column name.

## How the Figures Are Calculated

**Uptime** is successful checks divided by all checks in the range, as a percentage. It is the same figure the dashboard and the daily and weekly digests show. For HTTP monitors, a degraded check counts as failed.

**Days without data** are left out. A day with no recorded checks, such as one before a monitor was created, does not count as up or down; the summary's days-with-data column says how many days the figures come from.

**Response times** are averaged across checks, so a busy day weighs more than a quiet one. Cron jobs have none.

**Maintenance** minutes are listed for each monitor, counting overlapping windows once. Checks during maintenance still count toward uptime; to report uptime outside maintenance, subtract using the maintenance column.

Figures are unrounded, so the spreadsheet can format them to as many decimals as you want to show.

## Who Can Download

Every member of the team can download reports. A report shows the same history the dashboard shows, and downloads work whether or not the team's subscription is active.

Reports are also available through the API with an API key holding the **reports:read** permission.
