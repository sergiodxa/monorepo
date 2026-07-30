# ADR-018: Add a Dead-Letter Queue for the `ping` Queue

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§4 and §17 (low). Becomes materially more valuable once
[ADR-003](./ADR-003-schedule-http-checks-from-next-due-at.md) lands — see Consequences.

## Context

`wrangler.jsonc` declares the queue with no options:

```jsonc
"queues": {
  "consumers": [{ "queue": "ping" }],
  "producers": [{ "binding": "QUEUE", "queue": "ping" }],
},
```

So every default applies: `max_batch_size` 10, `max_batch_timeout` 5 s, `max_retries` 3 — and
**no `dead_letter_queue`**. Per Cloudflare's batching-and-retries documentation, a message that
exhausts its retries with no DLQ configured is **discarded**.

Discarding is cheap. It is also silent: nothing records that a check was scheduled and never
performed.

Two paths reach it.

**Infrastructure faults.** `CheckHttpJob` is deliberate about which failures retry — only D1, the
Durable Object namespace, or an unexpected internal fault throw `Job.RetryError`:

```ts
throw new Job.RetryError("HTTP check failed before a result was recorded", { cause: error });
```

A monitored endpoint that times out, refuses the connection, or returns the wrong status is a
valid monitoring result: stored, alerted on, acked. That is the right split. But it means a
retry-exhausted message is always an *infrastructure* failure — precisely the class worth knowing
about — and it vanishes.

**Malformed messages.** The consumer acks anything that fails schema validation:

```ts
if (!result.success) {
  logger.error("queue.invalid_message", { body: message.body });
  message.ack();
  continue;
}
```

and `Job.NonRetriableError` also acks. Both log first, so these are at least visible in logs — but
only in logs, and only for as long as log retention holds.

Today the consequence is bounded by an accident: because `findDue` recomputes due monitors from
result history, a monitor whose check message was dropped **still reads as due on the next cron
delivery**, so it is re-enqueued a minute later. The lost check self-heals within one interval.
That accident is exactly what ADR-003 removes.

## Decision

**1. Declare a dead-letter queue.**

```jsonc
"queues": {
  "consumers": [
    {
      "queue": "ping",
      "dead_letter_queue": "ping-dlq",
      "max_retries": 3,
    },
  ],
  "producers": [{ "binding": "QUEUE", "queue": "ping" }],
},
```

State `max_retries` explicitly even though 3 is the default — a retry policy paired with a DLQ
should be visible in the config rather than inherited, since the two numbers only make sense
together.

**2. Give the DLQ a consumer that records rather than retries.**

A DLQ with no consumer is a queue that fills up; a DLQ whose consumer retries the work reinvents
the retry loop. The consumer should do one thing: make the failure durable and visible. Log at
error level with the message body, the job type, and `message.attempts`, then ack. If it should
also surface in the product — a "checks we failed to run" signal on the monitor detail page — that
is a follow-up, not this ADR.

**3. Also send validation failures there.**

The `!result.success` branch currently logs and acks. Sending it to the DLQ instead of acking
would keep the payload for inspection, which is the whole point of the branch's existing
`logger.error("queue.invalid_message", { body: message.body })`. Doing this via
`message.retry()` would burn three redeliveries first, so it needs an explicit producer send to
`ping-dlq` rather than a retry — worth doing, and worth noting that it makes the DLQ carry two
distinct failure kinds that its consumer must tell apart.

## Cost

Negligible, and only paid on failure. Per the Queues pricing model, a message that is retried 3
times and then dead-lettered incurs its original write, 4 reads (1 delivery + 3 retries), 1 delete,
plus 1 write and 1 read and 1 delete in the DLQ — roughly 9 operations, $0.0000036 per
dead-lettered message. At any sane failure rate this rounds to zero. The DLQ costs nothing while
empty.

## Consequences

- **Silently lost checks become visible.** The current behaviour has no signal at all: no metric,
  no row, nothing beyond a log line that may not be looked at. For a monitoring product, "we
  failed to run your check and told nobody" is the worst available outcome.
- **Materially more valuable after ADR-003.** Once `next_due_at` is claimed up front, a dropped
  message no longer self-heals on the next cron tick — the due time has already advanced, so the
  monitor simply misses that interval. ADR-003's own Consequences section flags this and points
  here. The two should ship close together, and if only one can ship first, this one is the safer
  order.
- **Requires creating the `ping-dlq` queue** before deploying the config that references it
  (`wrangler queues create ping-dlq`), or the deploy fails.
- **A DLQ can itself back up.** Its consumer must always ack — including on unparseable bodies —
  or messages accumulate against the queue's retention. The consumer's job is to record, never to
  reject.
- **Log volume rises during an incident.** A D1 outage that fails thousands of checks produces
  thousands of DLQ error logs. That is the correct signal, but it is worth a note in the log
  identifier so it can be filtered — `Job.run` already namespaces logs as
  `job:<kebab-name>:<message id>`, and the DLQ consumer should follow the same shape.
- Independent of every other ADR in this series except the sequencing note above.
