---
title: Defense in Depth for Rate Limiting
excerpt: Why single layer rate limiting fails, and how layered strategies protect against different threat vectors.
---

Rate limiting seems simple until attackers find the gaps. A single layer at your API gateway might stop volumetric attacks, but it won't prevent credential stuffing across thousands of IPs. Identity based limiting protects individual accounts, but can't stop distributed denial of service. The solution is **defense in depth**: multiple layers of rate limiting, each protecting against different threats.

## The Problem with Single Layer Limiting

Most applications start with IP based rate limiting at the edge. It's easy to implement and catches obvious abuse. But IP based limiting has fundamental weaknesses.

**Corporate NAT problem**: hundreds of legitimate users behind a single IP address. Strict IP limits block real users. Loose limits let attackers through.

**Distributed attacks**: botnets spread requests across thousands of IPs. Each individual IP sends few requests, staying under limits while collectively overwhelming your service.

**Account targeting**: an attacker probing a specific account sends requests from rotating IPs. IP limits never trigger because no single IP sends enough requests.

Conversely, identity based limiting alone has its own gaps. It requires knowing who's making the request, which means processing authentication first. Volumetric attacks exhaust your compute before identity checks run.

## Layered Rate Limiting Strategy

Effective rate limiting uses multiple layers, each with different visibility and protection scope.

**Edge layer (IP based)**: runs before your application code, on a CDN or edge network. Protects infrastructure from volumetric attacks. Cheap to execute. Knows nothing about your users.

**Application layer (identity based)**: runs inside your application logic. Protects individual accounts and enforces business rules. Requires knowing who's making the request.

**Resource layer (operation based)**: limits expensive operations regardless of source. Protects specific database queries, external API calls, or compute intensive functions.

Each layer catches what the others miss. Edge limiting stops distributed attacks early. Identity limiting protects accounts even when attackers rotate IPs. Resource limiting prevents any single request from exhausting shared resources.

## IP Based vs Identity Based Limiting

The distinction between IP and identity based limiting reflects different threat models.

**IP based limiting** answers: "Is this network address sending too many requests?" It's effective against:

- Single source flooding
- Simple automated scripts
- Resource exhaustion from misconfigured clients

It fails against:

- Distributed attacks
- Attackers behind VPNs or Tor
- Legitimate users behind shared IPs

**Identity based limiting** answers: "Is this user/account/email experiencing too many attempts?" It's effective against:

- Credential stuffing targeting specific accounts
- Account takeover attempts
- API abuse by authenticated users

It fails against:

- Attacks before authentication
- Account enumeration (if checked after validation)
- Volumetric attacks (too expensive to check identity first)

The timing of identity checks matters. If you verify rate limits after authentication, attackers can still probe for valid accounts by measuring response times. Checking limits before any password verification prevents information leakage.

## Rate Limiting Algorithms

Different algorithms suit different use cases. The choice affects how bursty traffic is handled and how the limit "feels" to users.

### Fixed Window

Count requests within fixed time periods (e.g., every minute from :00 to :59). Simple to implement and reason about. The weakness is boundary attacks: an attacker sends the full limit at :59, then again at :00, doubling effective throughput.

```ts
let count = getCurrentWindowCount(key);
if (count >= limit) return blocked;
incrementCount(key);
```

### Sliding Window

Track requests across a sliding time period. Smoother than fixed windows because there's no boundary to exploit. More complex to implement correctly, requiring either per-request timestamps or weighted averages.

### Token Bucket

Users accumulate tokens over time up to a maximum. Each request consumes a token. Allows controlled bursts while maintaining average rate. Good for APIs where occasional traffic spikes are acceptable but sustained high throughput isn't.

### Leaky Bucket

Requests enter a queue that drains at a fixed rate. Smooths traffic to a constant rate regardless of bursts. Useful when downstream systems can't handle variable load.

For most web applications, **fixed window** provides sufficient protection with minimal complexity. The boundary attack is theoretical for human users and the simplicity aids debugging. Use sliding window or token bucket when you need precise rate control or graceful burst handling.

## Choosing Limits

Setting limits is more art than science. Too strict and you frustrate legitimate users. Too lenient and you don't stop attackers.

**Authentication endpoints**: 5 to 10 attempts per minute per identifier. Legitimate users rarely need more than a few tries. Failed logins should prompt password reset, not unlimited retries.

**Password reset and verification**: 3 attempts per 5 to 10 minutes. These endpoints are high value targets. Legitimate use is infrequent.

**API endpoints**: depends entirely on your use case. Consider the cost per request (database queries, external API calls, compute) and expected access patterns. A read heavy analytics API might allow 1000 requests per minute. A write heavy transactional API might allow 100.

**Registration**: very strict, perhaps 3 to 5 per 5 minutes. New account creation is an infrequent action for legitimate users. Attackers abuse registration for spam, fake accounts, or enumeration.

## Operational Considerations

Rate limiting requires ongoing attention, not just initial configuration.

### Monitoring

Track rate limit events in your observability system. Monitor both blocked requests and requests approaching limits. Alert when legitimate users hit limits frequently, which indicates either too strict limits or UX problems encouraging excessive retries.

### Graceful Response

Return 429 status with a `Retry-After` header. Include human readable messages. Consider different responses for different scenarios: "Please wait 30 seconds" is friendlier than "rate_limit_exceeded".

```ts
{
  status: 429,
  headers: { "Retry-After": "60" },
  body: {
    error: "too_many_attempts",
    message: "Too many requests. Please try again in 1 minute.",
    retryAfter: 60
  }
}
```

### Client Behavior

Well behaved clients respect `Retry-After` and implement exponential backoff. Document expected client behavior in your API docs. Poorly behaved clients that hammer your API after 429s might warrant escalating responses: temporary blocks, then longer blocks, then requiring human verification.

### Adjusting Limits

Start conservative and loosen based on data. It's easier to relax limits than to tighten them (users notice when things that worked stop working). Review limits quarterly or when traffic patterns change significantly.

## State Management Trade-offs

Rate limiting requires state: you need to count requests somewhere. Where you store that state affects consistency, performance, and failure modes.

**In memory (per instance)**: fast but inconsistent across instances. An attacker can exceed limits by distributing requests across your fleet. Acceptable for low stakes limiting or when combined with other layers.

**Distributed cache (Redis)**: consistent across instances. Adds latency to every request. Single point of failure unless clustered.

**Edge service (Cloudflare, AWS WAF)**: runs before your application. Extremely fast. Limited customization. Can't use application specific identifiers.

**Durable Objects or similar stateful primitives**: per tenant consistency without global coordination. Natural fit for multi tenant applications where each tenant's limits are independent.

For defense in depth, use edge services for IP based limiting (fast, before compute costs) and application level state for identity based limiting (can access user context).

## When Rate Limiting Isn't Enough

Rate limiting is one tool, not a complete security strategy. It doesn't protect against:

- Single malicious requests (SQL injection, XSS)
- Slow attacks that stay under limits
- Attacks that don't require high volume (session hijacking)
- Insider threats

Combine rate limiting with input validation, authentication, authorization, and monitoring. No single control prevents all abuse.

## Summary

Defense in depth for rate limiting means multiple layers with different scopes:

- **Edge layer**: IP based, stops volumetric attacks before they reach your application
- **Application layer**: identity based, protects individual accounts regardless of source IP
- **Resource layer**: operation based, protects expensive operations from abuse

Choose algorithms based on your tolerance for burst traffic and implementation complexity. Set limits conservatively and adjust based on real traffic data. Monitor rate limit events and respond gracefully with actionable information.

Rate limiting evolves with your application. What works at launch won't work at scale. Revisit your strategy as traffic patterns change and new attack vectors emerge.
