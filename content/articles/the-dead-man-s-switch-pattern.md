---
title: The Dead Man's Switch Pattern
excerpt: Understanding why passive monitoring inverts the typical health check model.
---

Most monitoring systems work by actively checking if something is running. You ping a server, it responds, and you know it's alive. But for scheduled tasks like cron jobs, this model breaks down completely.

A cron job that runs at 3 AM doesn't have a server listening for health checks. There's nothing to ping between executions. The job either runs or it doesn't, and if it doesn't, silence is the only signal you get.

## The Inversion

The dead man's switch pattern flips the monitoring relationship. Instead of the monitor asking "are you alive?" and waiting for a response, the monitored system announces "I'm still here" at expected intervals. If the announcement stops, something is wrong.

This pattern gets its name from safety devices in trains and heavy machinery. A dead man's switch requires continuous pressure to stay engaged. If the operator becomes incapacitated, the switch releases and triggers an emergency stop.

In software, the same principle applies. Your cron job pings a monitoring endpoint every time it runs successfully. The monitor expects these pings at regular intervals. No ping within the expected window means the job failed, crashed, or never started.

## Active Polling vs Passive Heartbeats

Active polling works when you have a persistent process:

```
Monitor → "Are you alive?" → Service
Monitor ← "Yes" ← Service
```

Passive heartbeats work when the process is ephemeral:

```
Cron Job → "I just ran" → Monitor
(silence)
Monitor → "No heartbeat received, alerting..."
```

The fundamental difference is who initiates communication. Active polling requires the monitored system to be available when asked. Passive heartbeats only require the system to report when it acts.

## Late vs Missed

A subtle but important distinction emerges with this pattern: the difference between "late" and "missed" states.

A **late** state means the heartbeat arrived, but after the expected window. Your job that should complete by 3:05 AM finished at 3:47 AM. It ran, it succeeded, but something caused unusual delay.

A **missed** state means no heartbeat arrived at all. The job either never started, crashed mid-execution, or completed but failed to send its ping.

These states require different responses, similar to how [the three states of service health](/articles/the-three-states-of-service-health) (healthy, degraded, down) enable proportional incident response. Late jobs might indicate resource contention, growing data volumes, or infrastructure issues worth investigating. Missed jobs are immediate emergencies requiring intervention. Designing appropriate [grace periods](/articles/designing-grace-periods-for-variance) helps distinguish between acceptable variance and actual failures.

## Beyond Cron Jobs

The pattern applies anywhere you have intermittent, expected activity:

**IoT devices** that should report sensor readings every 15 minutes. If a device goes silent, it might have lost power, network connectivity, or failed entirely.

**Edge workers** processing queued tasks. Each worker should heartbeat while processing. Silence indicates the worker crashed or the queue is stuck.

**Distributed system nodes** in a cluster. Regular heartbeats confirm nodes are participating. Missing heartbeats trigger failover or rebalancing.

**Batch processing pipelines** where each stage should complete within a window. A stage that doesn't report completion blocks downstream processing.

## Implementation Considerations

The monitor needs to know your expected schedule. For a job running every hour, the monitor expects a ping roughly every hour. For a job running daily at 3 AM, the monitor expects a ping around 3 AM each day.

This creates a dependency: your monitoring configuration must stay synchronized with your actual schedule. Change the cron expression without updating the monitor, and you'll get false alerts.

Most monitoring services solve this by letting you define the expected interval or schedule directly. Some can even parse cron expressions to understand when pings should arrive.

## The Trust Model

Dead man's switch monitoring trusts that a ping means success. This trust can be misplaced if you ping at the wrong point in your job's execution. The [position of your health check](/articles/why-ping-at-the-end-changes-everything) fundamentally changes what you're actually monitoring.

The pattern also assumes network reliability between your job and the monitor. A job that completes successfully but can't reach the monitoring endpoint will trigger false alerts. This is usually acceptable because network failures affecting your monitoring likely affect your users too.

## When Not to Use It

Don't use dead man's switch monitoring for services that should be continuously available. A web server should respond to active health checks. A database should accept connections on demand.

The pattern is specifically for processes that run, complete, and exit. If your system should always be listening, use active monitoring. If your system should periodically act and report, use passive heartbeats.
