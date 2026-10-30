---
title: Send signed webhooks
description: Let your users register an endpoint, and deliver each event to it from a job, signed as Standard Webhooks and retried on a growing delay.
section:
    title: Recipes
    order: 1.7
order: 19
lastUpdated: 2026-10-25
outcomes:
    - "What guides build outgoing webhooks, and in what order to follow them"
    - "Where an endpoint's URL is checked and its signing secret is kept"
    - "How your users verify a delivery with any Standard Webhooks library"
---

By the end of this recipe your users register a URL and receive a signed `POST` there whenever
an event happens in your app. Each delivery runs in its own job, so a slow endpoint holds up
nobody else, and a failed one is retried on a growing delay. Deliveries follow Standard Webhooks,
so your users verify them with any library that implements it.

## Register an endpoint

The URL is one a user typed, so refuse private and reserved hosts when it is saved, as
[Refuse the URL at the endpoint](/docs/identity-and-security/fetch-untrusted-urls#refuse-the-url-at-the-endpoint)
does. Mint the endpoint's `whsec_` secret as the end of
[Send webhooks of your own](/docs/identity-and-security/webhooks#send-webhooks-of-your-own)
describes, show it once, and store it with `sealSecret` from
[Seal secrets at rest](/docs/identity-and-security/web-crypto#seal-secrets-at-rest).

## Run deliveries as jobs

Declare `webhooks.deliver` as
[Declare the job a delivery becomes](/docs/identity-and-security/webhooks#declare-the-job-a-delivery-becomes)
does, and build the queue, the dispatcher and `ctx.jobs` with
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron).

## Sign and deliver each event

Write the delivery job from
[Send webhooks of your own](/docs/identity-and-security/webhooks#send-webhooks-of-your-own),
opening the stored secret with `openSecret` before `Webhooks.sign`. Where the event happens,
store it and call `ctx.jobs.enqueueMany(jobs.webhooks.deliver, …)` with one input per endpoint.
For an endpoint that answers `429` with `Retry-After`, wait as long as it asks:
[Honor Retry-After](/docs/data-and-background-work/retry-with-backoff#honor-retry-after).

> [!WARNING]
> Keep the backoff's ceiling plus its jitter under 12 hours, the longest Cloudflare Queues holds a
> message, and give the queue enough `maxRetries` to reach it.

## Tell your users how to verify

Each delivery carries the `webhook-id`, `webhook-timestamp` and `webhook-signature` headers
Standard Webhooks defines, so your documentation names the standard and the endpoint's secret.
A user on Remix verifies with `@sdxc/webhooks` as
[Verify, then enqueue](/docs/identity-and-security/webhooks#verify-then-enqueue) shows.

## Test it

Test each stage as its guide does:
[Test the exact delays](/docs/data-and-background-work/retry-with-backoff#test-the-exact-delays)
checks the waits between attempts, and
[Test the receiver](/docs/identity-and-security/webhooks#test-the-receiver) signs a delivery the
way your job does.

## Where to go next

- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — check where
  an endpoint's name resolves, beyond its spelling.
- [Sign and verify HTTP requests](/docs/identity-and-security/http-message-signatures) — sign
  with a key pair, so users verify without a shared secret.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — test the exact
  delays your deliveries wait.
