---
title: The Three States of Service Health
excerpt: Why binary health checks miss the problems that matter most to users.
---

Binary health checks answer a simple question: is the service up or down? But real services exist in more nuanced states. A service responding to every request with 30-second latency is technically "up" while being effectively unusable.

## The Inadequacy of Up/Down

Traditional health checks return one of two states:

- **Up**: The service responded
- **Down**: The service didn't respond

This model works for detecting catastrophic failures. Server crashed? Down. Network unreachable? Down. Process died? Down.

But it misses an entire category of problems:

- Database queries taking 10x longer than normal
- Memory pressure causing garbage collection pauses
- Thread pool exhaustion making requests queue
- Downstream dependency degradation propagating upstream

In each case, the service is "up" by the binary definition. It accepts connections and returns responses. Users experience something very different.

## Introducing the Degraded State

A three-state model captures reality better:

- **Healthy**: Service is performing within expected parameters
- **Degraded**: Service is responding but with reduced performance or reliability
- **Down**: Service is not responding

The degraded state is where most user-impacting issues live. Your service isn't completely broken, but it's not working well either.

## When Slow Is Worse Than Down

A completely down service has one advantage: it fails fast. Load balancers route around it. Clients retry against other instances. Circuit breakers open. The system adapts.

A slow service is insidious. It ties up connections waiting for responses. Timeouts haven't triggered yet, so retries don't happen. The slowness propagates to every service that depends on it.

Consider a checkout flow:

1. User clicks "Purchase"
2. Frontend calls the order service
3. Order service calls inventory (slow)
4. Order service calls payment (waiting on inventory)
5. Frontend times out after 30 seconds
6. User clicks "Purchase" again
7. Now you have duplicate order attempts

A service that responded "down" immediately would have failed the first request in milliseconds. The user would see an error and retry once. The slow service created a cascade of problems.

## Response Time Thresholds

The degraded state needs concrete criteria. Response time thresholds are the most common:

```yaml
health_check:
  healthy: response_time < 200ms
  degraded: response_time < 2000ms
  down: response_time >= 2000ms or no_response
```

These thresholds should reflect user experience, not arbitrary numbers. If your users expect sub-second responses, a 500ms response time is degraded even if the server thinks it's fine.

## Error Rate Thresholds

Response time thresholds work well with [grace periods](/articles/designing-grace-periods-for-variance) to handle natural variance in system performance. Response time isn't the only signal. Error rates matter too:

```yaml
health_check:
  healthy: error_rate < 0.1%
  degraded: error_rate < 5%
  down: error_rate >= 5%
```

A service returning errors for 2% of requests is degraded. It's not down, but something is wrong. Maybe a database replica is out of sync. Maybe a cache is returning stale data. Maybe a downstream service is partially failing.

## Combining Signals

Real health checks combine multiple signals. This is the foundation of [multi-protocol monitoring](/articles/why-multi-protocol-monitoring-matters), where TCP, HTTP, and content checks work together to pinpoint issues:

```yaml
health_check:
  conditions:
    - response_time < 200ms
    - error_rate < 0.1%
    - cpu_usage < 80%
    - memory_usage < 85%
    - connection_pool_available > 10%

  healthy: all conditions pass
  degraded: any condition fails
  down: response_time >= 2000ms or no_response
```

A service with fast responses but 90% CPU usage is degraded. It's working now, but it's one traffic spike away from problems.

## Acting on Degraded State

The degraded state enables proportional responses:

**Healthy**: Normal operation. Route traffic normally.

**Degraded**:

- Reduce traffic to this instance
- Alert on-call for investigation
- Prepare to scale up or fail over
- Enable more aggressive caching

**Down**:

- Remove from load balancer rotation
- Page on-call immediately
- Trigger automated recovery
- Route all traffic elsewhere

Without the degraded state, you either ignore problems until they become outages or treat every minor issue as an emergency.

## Early Warning Systems

Degraded states create early warning systems. A service that transitions from healthy to degraded is telling you something is changing. Maybe:

- Traffic is increasing toward capacity limits
- A dependency is starting to slow down
- Resource usage is trending upward
- Data volume is growing beyond what the system handles well

Catching these transitions gives you time to respond before users notice. Scale up before you need to. Investigate the slow dependency before it fails completely. Add capacity before you run out.

## Implementation Patterns

Health check endpoints should return structured data, not just status codes. As explored in [status codes lie](/articles/why-status-codes-lie-in-health-checks), a 200 response doesn't guarantee your service is actually healthy:

```json
{
	"status": "degraded",
	"checks": {
		"database": { "status": "healthy", "latency_ms": 12 },
		"cache": { "status": "healthy", "latency_ms": 2 },
		"payment_api": { "status": "degraded", "latency_ms": 1847 }
	},
	"timestamp": "2024-01-15T10:30:00Z"
}
```

This response tells you not just that the service is degraded, but why. The payment API is slow. Everything else is fine. You know exactly where to look.

Load balancers and monitoring systems can parse this structure and make intelligent decisions. Route less traffic to degraded instances. Alert specifically about the payment API. Track latency trends over time.

## The User Perspective

Ultimately, health states should reflect user experience. A service is healthy when users can accomplish their goals quickly and reliably. It's degraded when users notice slowness or occasional errors. It's down when users can't use it at all.

Technical metrics like CPU and memory are proxies for user experience. They're useful because they're easy to measure and often correlate with problems. But the real question is always: can users do what they came to do?
