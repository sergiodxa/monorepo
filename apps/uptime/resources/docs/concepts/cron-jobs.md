---
title: Cron Job Monitoring
description: Ensure your scheduled tasks and background jobs run on time. Get alerted when jobs are late or miss their expected schedule.
section:
  title: Concepts
  order: 2
order: 5
lastUpdated: 2026-08-02
---

Unlike HTTP monitors that actively check endpoints, cron monitors work by receiving pings from your jobs—if a ping doesn't arrive on time, you get alerted. This "dead man's switch" approach works for any scheduled task, regardless of where it runs or what technology it uses.

## How It Works

Cron job monitoring uses a "dead man's switch" approach:

1. **Define the expected schedule** - You tell Uptime when your job should run using a cron expression
2. **Your job pings Uptime** - At the end of each run, your job sends an authenticated HTTP request to the monitor's endpoint
3. **Uptime tracks the pings** - If a ping doesn't arrive within the expected window, Uptime marks the job as late or missed and sends you an alert

This approach works for any scheduled task, regardless of where it runs or what technology it uses.

## Authenticating Pings

Pings require an API key with the `cron-jobs:ping` scope, sent as an `Authorization: Bearer` header. Create one under **Settings** > **API Keys** and give it only that scope—a ping key can record pings and nothing else, so leaking it can't expose or change your monitors.

A key can only ping monitors belonging to the team that owns it. Pinging another team's monitor returns `404`, the same answer as an id that doesn't exist.

Store the key the way you store any other secret your job uses—an environment variable or your scheduler's secret store—rather than inlining it in a crontab. If it does leak, delete the key and create a new one; the monitor and its history are unaffected.

## Configuration Options

### Name and Description

Give your cron monitor a clear, descriptive name that identifies what the job does. The description field allows you to add additional context, such as what systems the job affects or who to contact if it fails.

### Cron Expression

Define when your job should run using standard 5-field cron syntax:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

**Common examples:**

| Expression     | Description                    |
| -------------- | ------------------------------ |
| `0 * * * *`    | Every hour, on the hour        |
| `*/15 * * * *` | Every 15 minutes               |
| `0 0 * * *`    | Daily at midnight              |
| `0 2 * * 0`    | Weekly on Sunday at 2:00 AM    |
| `0 0 1 * *`    | Monthly on the 1st at midnight |

### Timezone

Select the timezone your job runs in. This is critical for scheduled jobs - a job scheduled for "midnight" needs to know which midnight you mean.

If your server runs in UTC but your business logic expects local time, make sure to set the timezone accordingly.

### Grace Period

The grace period defines how long Uptime waits for a ping after the scheduled time before marking the job as late. You can set this between 1 and 60 minutes.

**How to choose a grace period:**

- Consider your job's typical duration
- Add buffer time for variable execution times
- Account for any delays in your scheduling system

For example, if your backup job usually takes 10 minutes but can take up to 20 minutes under heavy load, set a grace period of at least 25 minutes.

### Alert on Late

When enabled, you'll receive an alert as soon as the grace period expires without receiving a ping. If disabled, you'll only be alerted when the job is marked as missed (after the next scheduled run time passes).

## Monitor Statuses

Cron monitors have four possible statuses:

| Status      | Description                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Healthy** | The job is running on schedule. The last ping was received within the expected window.                                            |
| **Late**    | The grace period has passed without receiving a ping. The job may still be running or may have failed.                            |
| **Missed**  | The next scheduled run time has passed without ever receiving a ping for the previous run. The job definitely failed to complete. |
| **New**     | The monitor was just created and hasn't received its first ping yet.                                                              |

## Integration Examples

When you create a cron monitor, Uptime provides ready-to-use code snippets for integrating with your jobs. Every one of them reads the API key from the environment, so the key never appears in a crontab, a script, or a log line.

### cURL Command

The simplest way to ping Uptime from any environment:

```bash
curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping \
  -H "Authorization: Bearer $UPTIME_API_KEY"
```

### Bash / Crontab Integration

Add the ping to the end of your cron job:

```bash
# In your crontab
UPTIME_API_KEY=uptime_your_api_key
0 2 * * * /path/to/backup.sh && curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping -H "Authorization: Bearer $UPTIME_API_KEY"
```

Or within a shell script:

```bash
#!/bin/bash
set -e

# Your job logic here
pg_dump mydb > backup.sql
gzip backup.sql
aws s3 cp backup.sql.gz s3://my-bucket/

# Ping Uptime only if everything succeeded
curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping \
  -H "Authorization: Bearer $UPTIME_API_KEY"
```

### Application Code

Call the ping endpoint from within your application:

```javascript
// Node.js example
async function runScheduledJob() {
	// Your job logic here
	await generateDailyReport();
	await sendReportEmails();

	// Ping Uptime when complete
	await fetch("https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping", {
		method: "POST",
		headers: { Authorization: `Bearer ${process.env.UPTIME_API_KEY}` },
	});
}
```

```python
# Python example
import os
import requests

def run_scheduled_job():
    # Your job logic here
    sync_inventory_data()

    # Ping Uptime when complete
    requests.post(
        'https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping',
        headers={'Authorization': f"Bearer {os.environ['UPTIME_API_KEY']}"},
    )
```

## Best Practices

### Ping at the End, Not the Beginning

Always send the ping after your job completes successfully, not when it starts. Pinging at the start only confirms the job began - it tells you nothing about whether it finished or succeeded.

```bash
PING="https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping"
AUTH="Authorization: Bearer $UPTIME_API_KEY"

# Wrong - pings before the job runs
curl -X POST "$PING" -H "$AUTH"
./backup.sh

# Correct - pings only after success
./backup.sh && curl -X POST "$PING" -H "$AUTH"
```

### Set Appropriate Grace Periods

Account for your job's actual duration plus some buffer:

- If your job takes 5 minutes, don't set a 5-minute grace period
- Allow for network latency, variable load, and occasional slowdowns
- Review and adjust grace periods if you get false alerts

### Use Descriptive Names

Name monitors clearly so anyone on your team understands what failed:

- "Database backup (production)" instead of "backup"
- "Daily sales report generation" instead of "report job"
- "Inventory sync from warehouse API" instead of "sync"

### Consider Timezone Carefully

For jobs tied to business hours or daily schedules:

- Set the timezone to match your business operations
- Document the timezone in the description
- Be aware of daylight saving time transitions

### Monitor Critical Background Jobs

Prioritize monitoring for jobs where failure has significant impact:

- **Database backups** - Ensure your disaster recovery is actually working
- **Report generation** - Know immediately if stakeholders won't get their reports
- **Data synchronization** - Catch integration failures before they cascade
- **Cleanup jobs** - Prevent disk space issues from failed log rotation or temp file cleanup
- **Certificate renewal** - Avoid surprise SSL expirations
- **Billing and invoicing** - Ensure critical business processes complete
