# Reports

## Purpose

Reports export a team's monitor history as CSV, so it can be kept, charted, or sent to the client whose services the team monitors.

## What Users Configure

- Range: whole UTC days, both ends inclusive, at most 366 days, ending yesterday at the latest
- Quick ranges: last month (the default), last 30 days, last quarter, year to date
- Monitors: every monitor, the monitors attached to one status page, or every monitor of one type
- Format: spreadsheet or standard CSV
- Report: uptime summary or daily uptime

## How It Works

1. The user opens Reports, chooses a range, monitors and format, and presses a download button.
2. The form submits as `GET`, and each button targets one report's download URL, or the ZIP
   holding both reports.
3. The report is computed from the daily roll-up at download time and streamed as CSV.
4. A range or filter the report cannot use returns the user to the form with the problem shown and the fields kept.

## Reports

- **Uptime summary**: one row per monitor for the range with days with data, total, successful and failed checks, uptime percentage, average and maximum response time, days down, days degraded and maintenance minutes
- **Daily uptime**: one row per monitor per day with that day's checks, uptime percentage, response times, status and maintenance minutes
- **Both as ZIP**: the two reports above as CSV files in one ZIP, for the same range, monitors and format, named as their single downloads are; the ZIP is named `<team>-uptime-reports-<period>.zip` and stores the files uncompressed

## Formats

- **Spreadsheet**: translated headers, types and statuses, the locale's decimal mark, `;` between columns wherever the decimal mark is `,`, and a UTF-8 byte order mark
- **Standard**: `,` between columns, fixed snake_case headers, dot decimals, no byte order mark; the API always writes this format

## Rules

- Uptime is check-weighted: successful checks divided by all checks
- HTTP degraded checks count as failed, as in the daily roll-up
- A day without a roll-up row is left out and not counted as up
- Maintenance minutes are reported per monitor with overlaps merged; they do not change uptime
- Paused monitors are included; deleted monitors are not
- Figures are unrounded
- Formula-like text in monitor names is neutralized so spreadsheets show it as text
- Filenames carry the team slug, the report and the range, with a whole month written as `YYYY-MM`

## Access

- Any team member can download reports, regardless of subscription state
- The API serves both reports as CSV or JSON to keys holding `reports:read`

## Feature Interactions

- Status pages act as the per-client monitor filter
- Maintenance windows supply the maintenance minutes
- The daily roll-up that feeds the digests and uptime bars feeds the reports too
