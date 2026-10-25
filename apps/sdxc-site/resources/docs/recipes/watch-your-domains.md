---
title: Watch your domains
description: Check every domain's registration expiry and email authentication on a schedule, and alert chat or a paging service before a lapse or a broken record takes it down.
section:
    title: Recipes
    order: 1.7
order: 14
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a domain monitor, and in what order to follow them"
    - "How the expiry sweep and the email-authentication audit run on cron triggers"
    - "When each check alerts, and when an alert pages someone"
---

By the end of this recipe your app checks every domain it tracks on a schedule: its registration
expiry over RDAP, and the DMARC, SPF and DKIM records receivers judge its mail by. A renewal
reminder or a record that stopped passing reaches your chat, and a domain about to stop
resolving pages whoever is on call.

## Set up the queue and the dispatcher

Both checks run as jobs, so the queue, the dispatcher and the Worker's `scheduled` handler come
first. Follow [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron).

## Connect chat and paging

The checks hand every alert to the delivery job, so it exists before them. Follow
[Send alerts to chat and paging services](/docs/data-and-background-work/messaging) through
[Fan out by severity](/docs/data-and-background-work/messaging#fan-out-by-severity), whose
`notifyTeam` sends `critical` messages to paging channels and everything to chat. A job passes
the dispatcher from `~/app/initializers/dispatcher` as its enqueuer.

## Watch registration expiry

Follow [Watch when a domain expires](/docs/data-and-background-work/domain-expiry), which sweeps
your domains every hour. Its `Domains.alertExpiry` builds a `Message` keyed
`expiry:<domain>` and passes it to `notifyTeam`: `critical` when `needsAlert` fired for an
expired domain or a status that stops it resolving, and `warning` for a renewal reminder, so a
reminder stays in chat.

## Audit email authentication every day

Follow [Check a domain's email authentication](/docs/data-and-background-work/email-authentication)
through
[Run the audit off the request](/docs/data-and-background-work/email-authentication#run-the-audit-off-the-request),
which audits one domain per job. Schedule a daily job that enqueues one audit per domain with
`sdxc make job sending-domains/audit-all --cron "0 6 * * *"`. Its handler reads every domain from `SendingDomains` and calls
`dispatcher.enqueueMany(jobs.sendingDomains.audit, …)` with one `{ domainId }` each, so a
resolver that times out retries that domain alone. In the audit job, compare the new findings
with the stored ones before `saveFindings`: a check that passed and now fails sends a `warning`
keyed `email-auth:<domain>` through `notifyTeam`, and a domain whose checks all pass again sends
the same key with `state: "resolved"`.

## Test it

Test each stage as its guide does:
[Test the decisions](/docs/data-and-background-work/domain-expiry#test-the-decisions) checks
when an expiry alerts, and
[Test the checks](/docs/data-and-background-work/email-authentication#test-the-checks) answers
the DNS lookups each audit makes.

## Where to go next

- [Custom domains for your customers](/docs/identity-and-security/verify-domains) — prove a
  customer owns a domain before you start watching it.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — the schedules
  behind the sweep's and the delivery job's retries.
- [Read DMARC aggregate reports](/docs/data-and-background-work/email-authentication#read-dmarc-aggregate-reports)
  — see who sends mail as your domain once its records pass.
