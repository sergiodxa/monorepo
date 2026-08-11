---
title: Quick Start Guide
description: This guide walks you through creating your first HTTP monitor and setting up alerts. You'll be monitoring your service in under 5 minutes.
section:
  title: Getting Started
  order: 1
order: 2
lastUpdated: 2026-02-14
---

Before you begin, you'll need an Uptime account and a publicly accessible URL to monitor (website, API endpoint, or health check route).

## Step 1: Create Your First HTTP Monitor

- An Uptime account (sign up at the homepage if you don't have one)
- A publicly accessible URL to monitor (website, API endpoint, or health check route)

HTTP monitors are the most common way to track service availability. They send requests to your URL and verify the response.

1. Navigate to **Monitors** in the sidebar
2. Click **Create Monitor**
3. Fill in the basic details:
   - **Name**: A descriptive name (e.g., "Production API" or "Marketing Website")
   - **URL**: The full URL to monitor (e.g., `https://api.example.com/health`)
4. Configure the check settings:
   - **Method**: Select `HEAD` for simple availability checks, or `GET` if you need response body validation
   - **Expected Status**: Usually `200`, but set this to whatever your endpoint returns on success
   - **Interval**: How often to check (1-60 minutes). Start with 5 minutes for most services
5. Choose a **Region** closest to your users or where you want to measure performance from
6. Click **Create Monitor**

Your monitor starts checking immediately. You'll see results appear in the dashboard within your configured interval.

> **Tip**: Use the **Run Now** button to test your monitor immediately after creation.

## Step 2: Set Up an Alert

Alerts notify you when your monitor detects a problem. Without alerts, you'd have to watch the dashboard constantly.

1. Navigate to **Alerts** in the sidebar
2. Click **Create Alert**
3. Configure the alert:
   - **Name**: Describe what this alert is for (e.g., "Production API Down")
   - **Monitor**: Select the monitor you just created, or leave blank to alert on all monitors
4. Choose your notification channel:
   - **Email**: Enter the recipient email address
   - **Slack**: Paste your Slack webhook URL
   - **Discord**: Paste your Discord webhook URL
   - **Webhook**: Send to any HTTP endpoint with a shared secret for verification
5. Optional settings:
   - **Notify on Recovery**: Get notified when the service comes back up (recommended)
   - **Cooldown**: Prevent alert spam by setting a minimum time between notifications
6. Click **Create Alert**

You'll now receive notifications when your monitored service goes down or recovers.

## Step 3: Verify Everything Works

1. Go back to **Monitors** and click on your new monitor
2. Check that results are appearing with the expected status code
3. Look at the response time to ensure it's within acceptable limits
4. If you set a degraded threshold (default 5000ms), responses slower than this will show as degraded

## What's Next?

Now that you have basic monitoring in place, explore these additional features:

### Other Monitor Types

- **DNS Monitors** - Watch a domain's records and get told when one changes, disappears, or appears. See [DNS Monitoring](/docs/concepts/dns-monitors).
- **TCP Monitors** - Check if a port is open and responding. Useful for databases and custom services. See [TCP Monitoring](/docs/concepts/tcp-monitors).
- **Cron Job Monitors** - Ensure your scheduled tasks run on time. Your jobs ping Uptime when they complete. See [Cron Job Monitoring](/docs/concepts/cron-jobs).

### Advanced HTTP Features

- **Content Checks** - Verify the response body contains (or doesn't contain) specific text
- **SSL Monitoring** - Get alerts before your SSL certificates expire
- **Custom Headers** - Monitor authenticated endpoints by adding Authorization headers

### Status Pages

Share your service status publicly with a hosted status page. See [Status Pages](/docs/concepts/status-pages).

### Maintenance Windows

Prevent false alerts during planned maintenance. See [Maintenance Windows](/docs/concepts/maintenance).

## Need Help?

- Check the [API Reference](/docs/api/overview) for programmatic access
- Review [Concepts](/docs/concepts/monitors) for detailed documentation on each feature
