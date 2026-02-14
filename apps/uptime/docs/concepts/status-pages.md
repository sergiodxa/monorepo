---
title: Status Pages
description: Create public or private status pages to communicate service health to your users and stakeholders.
section:
  title: Concepts
  order: 2
order: 7
lastUpdated: 2026-02-14
---

Status pages provide a single place where users, customers, and stakeholders can check whether your systems are operational without contacting support.

## Why Status Pages Matter

Status pages serve as a communication bridge between your team and everyone who depends on your services.

### Transparency with Customers

When something goes wrong, customers want to know. A status page gives them immediate answers without searching through social media or waiting on hold. This transparency builds confidence that you're aware of issues and actively working on them.

### Reduce Support Tickets During Outages

Without a status page, every user who encounters an issue will contact support asking "is it just me?" With a status page, they can self-serve that answer. During major incidents, this can reduce support volume dramatically.

### Build Trust

Publishing your uptime publicly demonstrates confidence in your service reliability. When customers see a track record of high availability, they trust that you take reliability seriously. Even when incidents occur, transparent communication builds more trust than silence.

### Keep Stakeholders Informed

Status pages aren't just for external customers. Internal teams, partners, and executives can all benefit from a quick way to check service health without pinging the on-call engineer.

## Configuration Options

When creating a status page, you can customize it to match your brand and control exactly what information is displayed.

### Name and Slug

The **name** is the internal identifier for your status page, used in the Uptime dashboard to help you manage multiple status pages.

The **slug** determines the URL path where your status page is accessible. For example, a slug of `platform` would be available at `/status/platform`. Choose a slug that's short, memorable, and relevant to the audience.

### Title and Description

The **title** appears at the top of your status page and should clearly identify what the page represents. For example, "Acme Platform Status" or "Developer API Status".

The **description** provides additional context below the title. Use it to explain what services are covered, link to additional resources, or provide contact information for urgent issues.

### Custom Logo

Upload your company or product logo to brand the status page. A recognizable logo helps users confirm they're on the official status page and not a phishing attempt.

Logos should be:

- PNG or SVG format
- Reasonably sized (recommended max 200px width)
- Visible on both light backgrounds

### Public or Private Visibility

**Public** status pages are accessible to anyone with the URL. No authentication required. This is the default and recommended setting for customer-facing status pages.

**Private** status pages require authentication to view. Users must be logged into your Uptime team to access them. Use private visibility for internal status pages that shouldn't be exposed publicly.

### Overall Status Indicator

When enabled, the status page displays a prominent indicator at the top showing the overall health of all included monitors:

- **All Systems Operational** — Every monitor is up
- **Partial Outage** — Some monitors are down or degraded
- **Major Outage** — Most or all monitors are down

This gives visitors an instant summary without scanning individual services.

### Select HTTP Monitors to Display

Choose which HTTP monitors appear on the status page. Each selected monitor shows:

- Service name
- Current status (up, down, degraded)
- Response time trend
- Uptime percentage over the selected time range

Not every monitor needs to be on your status page. Include only the services relevant to your status page's audience.

### Select Cron Jobs to Display

Choose which cron job monitors appear on the status page. For cron monitors, the page shows:

- Job name
- Current status
- Last successful check-in time
- Expected schedule

This helps users understand whether background processes like data syncs or scheduled reports are running on schedule.

## Maintenance Window Integration

When you schedule a maintenance window for a monitor, it automatically appears on any status page that includes that monitor.

During scheduled maintenance:

- The affected service shows a maintenance indicator instead of down status
- A banner appears explaining the maintenance
- The start time, expected end time, and description are displayed
- The overall status indicator accounts for planned maintenance separately from unexpected outages

This helps users distinguish between "something is broken" and "something is intentionally being worked on."

## Best Practices

### Only Show Customer-Facing Services

Your status page audience doesn't need to know about every internal service. Focus on:

- Services customers directly interact with (website, API, mobile app)
- Services that affect customer experience (payment processing, authentication)
- Background services customers depend on (email delivery, notifications)

Skip internal tools, development environments, and infrastructure components that don't directly impact users.

### Use Clear, Friendly Names

Customers don't know your internal service names. Translate technical names into user-friendly descriptions:

| Internal Name            | Status Page Name       |
| ------------------------ | ---------------------- |
| `api-gateway-prod`       | API                    |
| `auth-service-v2`        | Login & Authentication |
| `stripe-webhook-handler` | Payment Processing     |
| `sendgrid-relay`         | Email Delivery         |

### Add a Logo for Branding

A branded status page looks professional and helps users trust that they're viewing official information. Even a simple company logo makes a significant difference.

### Keep Public for Transparency

Unless you have a specific reason for privacy, keep your status page public. The benefits of transparency outweigh the minor risk of competitors seeing your uptime metrics. Most successful companies proudly publish their status pages.

### Create Separate Status Pages for Different Audiences

Consider creating multiple status pages for different use cases:

- **Customer status page** — Public, shows services end-users interact with
- **Developer status page** — Public, shows API endpoints, webhooks, and developer tools
- **Partner status page** — Private or public, shows services specific partners depend on
- **Internal status page** — Private, shows all services including internal tools

This ensures each audience sees relevant information without noise from services they don't use.
