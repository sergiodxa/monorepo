# ADR-008: Bounded-Concurrency Sweeps With Notification Off the Loop

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§17 (high, plus the leaked-timer item at low). Prerequisite for
[ADR-006](./ADR-006-honour-interval-seconds-for-tcp-and-dns.md).

## Context

Four jobs sweep every monitor of a type in one invocation, and all four do it **sequentially**:

```ts
for (let monitor of monitors) {
  try {
    let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);
    await TcpMonitor.recordCheckResult(db, monitor.id, result);
    await notifyTcpResult(db, resend, monitor, monitor.last_status, result);
    successCount++;
  } catch (error) { ... }
}
```

`CheckTcpJob`, `CheckDnsJob`, `CheckCronJobsJob`, and `CheckSslJob` share that shape. Per-
monitor latency adds up against a fixed interval budget:

| Job                | Cadence   |                Per-monitor worst case | Monitors before the sweep overruns |
| ------------------ | --------- | ------------------------------------: | ---------------------------------: |
| `CheckTcpJob`      | 5 min     |        `timeout_ms`, default 5,000 ms |                            **~60** |
| `CheckDnsJob`      | 1 hour    |               DoH round trip, ~200 ms |                            ~18,000 |
| `CheckCronJobsJob` | **1 min** | up to 4 D1 statements + an email send |                           **~200** |
| `CheckSslJob`      | 1 day     |      3 D1 statements + possible email |                         very large |

TCP is the nearest wall: sixty unreachable monitors platform-wide is enough for sweeps to
overlap, and overlapping sweeps double-check every monitor and double-write every result.
`CheckCronJobsJob` is the tightest budget — one minute — and it is the one doing inline
`await notifyCronJobResult(...)`, which on a transition performs a maintenance lookup, an
`alerts` full scan, a cooldown probe, an `alert_events` insert, and **an HTTPS round trip to
Resend**, all before the loop advances. A cron-monitor incident that transitions twenty
monitors at once serialises twenty email sends inside a sixty-second budget.

Two smaller defects compound it:

`checkTcpConnection` races the socket against a timer it never clears:

```ts
let outcome = await Promise.race([
	socket.opened.then(() => "connected" as const),
	new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), timeoutMs)),
]);
```

The pending `setTimeout` keeps the invocation alive for the full `timeout_ms` even when the
socket opens in 20 ms. Workers bills CPU, not wall clock, so this costs nothing — but in a
sequential loop it means every TCP check takes `timeout_ms`, not its actual latency. It turns
a 5-minute budget for 60 fast monitors into a 5-minute budget for 60 _slow_ ones.

`AggregateDailyStatsJob` has the same sequential shape for its `await this.write(db, ...)` per
monitor per day, on a daily budget — far more headroom, same pattern.

## Decision

**1. Clear the timer.** One-line fix in `app/services/tcp-check.ts`: capture the handle and
`clearTimeout` it in the existing `finally`. This alone changes a TCP sweep from
`N × timeout_ms` to `N × actual_latency`, which for healthy monitors is a 50–100× reduction in
sweep wall time. Do this first; it is the cheapest fix in this ADR by a wide margin.

**2. Replace `for … await` with bounded-concurrency batching** in all four sweeps and in
`AggregateDailyStatsJob`. A small shared helper, since five call sites want it:

```ts
// conceptually
for (let chunk of chunks(monitors, CONCURRENCY)) {
	await Promise.allSettled(chunk.map((monitor) => checkOne(monitor)));
}
```

`allSettled`, not `all`, so one monitor's failure does not abandon its chunk — matching the
per-monitor `try`/`catch` the loops already have. Concurrency of 10 is a reasonable start: it
is under the Workers simultaneous-subrequest ceiling with room for the D1 calls each check
makes, and it turns TCP's ~60-monitor wall into ~600.

**3. Move notification off the sweep loop.** A transition should enqueue a message, not send
an email inline. Add a `notify` message type carrying the monitor id, type, previous status,
and new status; the sweep enqueues, a consumer dispatches. That removes an HTTPS round trip
and up to five D1 statements from the critical path of every sweep, and it means a Resend
outage delays notifications instead of stalling the sweep that detects them.

This also fixes a correctness wrinkle: today a slow email send inside `CheckCronJobsJob`
delays the _evaluation_ of every monitor after it in the loop, so an incident can make the
system slower to notice further incidents.

## Implementation notes

- The sweeps already catch per-monitor errors and count successes/failures; keep that
  accounting, just per chunk.
- `CheckCronJobsJob` mutates `monitor.status` via `updateStatus` before notifying. With
  concurrency, two chunks never touch the same monitor, so no new races — but the status
  passed to `notifyCronJobResult` must remain the pre-update value, as it is today.
- Enqueuing notifications adds 3 queue operations per notification ($0.0000012). Negligible
  against the $0.0009 email it accompanies.
- The `notify` message must be idempotent enough to survive redelivery. `AlertEvent` already
  records every outcome, and `isInCooldown` plus [ADR-004](./ADR-004-bound-alert-repetition.md)'s
  per-incident cap bound duplicate sends; that is sufficient.

## Consequences

- **The TCP sweep's monitor ceiling rises from ~60 to ~600**, and with the timer fix the
  practical ceiling for healthy monitors is far higher still.
- **Unblocks [ADR-006](./ADR-006-honour-interval-seconds-for-tcp-and-dns.md).** Moving TCP to
  a 1-minute cadence is not viable with a sequential sweep; it is viable with a bounded
  concurrent one over a due-filtered set.
- **Sweep wall time stops being a function of the slowest monitor.** One hung target no
  longer delays every monitor behind it.
- **No meaningful cost change.** Workers bills CPU, not wall clock, so parallelising does not
  reduce the bill — it removes a throughput ceiling. The notification queue adds a few
  microdollars per incident.
- **Failure isolation improves**: a Resend outage or an `alerts` query error can no longer
  stall detection.
- **Concurrency of 10 is a guess.** It should be validated against the Workers
  simultaneous-connection limit and the D1 concurrent-statement behaviour under load;
  [ADR-019](./ADR-019-instrument-d1-rows-and-do-wall-time.md)'s logging makes the sweep's
  real duration observable so the constant can be tuned rather than assumed.
