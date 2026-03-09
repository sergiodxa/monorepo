---
title: Per-Tenant Rate Limiting on Cloudflare
excerpt: Why per-tenant limits need more than edge rules, and how Cloudflare API and in-memory strategies differ.
---

Per-tenant rate limiting looks straightforward until different kinds of abuse hit the same system. A public API might need to absorb bursts from shared networks, isolate one noisy tenant from another, and still keep infrastructure costs predictable. One limit rarely solves all three problems.

This is where Cloudflare edge controls and application-level counters start to complement each other. The trade-off is not simply speed versus accuracy. It is also about what identity each layer can see, where state lives, and which failure modes you are willing to accept.

## Why Per-Tenant Limits Matter

Tenant-level limits protect fairness. In a multi-tenant API, one customer should not be able to consume the capacity reserved for everyone else.

That sounds similar to IP-based protection, but the threat model is different. A tenant may legitimately send traffic from many IPs, and many tenants may share the same IP ranges through NAT, VPNs, or cloud infrastructure. If you only limit by network address, you often punish the wrong party.

Per-tenant limits also express business rules more clearly. A free plan may allow fewer requests than an enterprise plan, and a write-heavy endpoint may need a stricter cap than a read-heavy one. Those policies belong closer to tenant identity than to raw network metadata.

## The Limits of Edge-Only Protection

Cloudflare is a strong first layer because it can reject abusive traffic before your application spends compute on it. That makes edge rate limiting a good fit for broad infrastructure protection.

The problem is visibility. Edge rules usually reason about request properties such as IP address, path, headers, or bot signals. That is enough for coarse abuse prevention, but not always enough for tenant isolation. If tenant identity only becomes trustworthy after your application validates a token or API key, the edge cannot make the final decision on its own.

This is why edge-only protection often works best for volumetric control, not for enforcing tenant quotas. It can reduce noise quickly, but it cannot always answer, "Which tenant should pay for this request?"

## Cloudflare API-Based Limiting

Cloudflare API-based limiting is useful when you want centrally managed rules, low-latency enforcement, and minimal application overhead. It gives you an operational boundary outside your application code.

That comes with constraints. You only get the identifiers Cloudflare can reliably inspect at the edge. If a tenant identifier is available in a stable header or token claim that Cloudflare can evaluate, this approach can work well. If tenant identity depends on application-specific lookups, the model starts to break down.

The main advantage is cost control. Requests blocked at the edge never reach your application, database, or downstream services. The main limitation is that rule logic tends to be less expressive than what you can implement inside application code.

## In-Memory Tenant Counters

In-memory rate limiting moves the decision into your application process. That gives you richer context because you can rate limit after resolving the authenticated tenant, plan, endpoint class, or even operation cost.

This is often the simplest way to express per-tenant policy. You can maintain counters keyed by tenant identifier and tune limits per route or per plan without depending on edge rule capabilities.

The trade-off is consistency. In-memory counters are local to a process or instance. In a distributed deployment, a tenant can exceed the intended limit by spreading requests across instances. That may be acceptable for soft fairness controls, but it is weak for strict quotas or abuse prevention.

## What Each Strategy Sees

The real difference between Cloudflare API-based limiting and in-memory limiting is not where the code runs. It is what each layer knows when it makes the decision.

**Cloudflare API-based limiting** can usually see:

- IP address and network-level metadata
- Request path, method, and selected headers
- Signals available before application authentication finishes

It is a strong fit for:

- Broad abuse reduction
- Cost protection before compute starts
- Simple tenant keys exposed safely at the edge

It becomes weaker when:

- Tenant identity depends on application lookups
- Limits vary by plan or operation cost
- You need exact per-tenant consistency across complex rules

**In-Memory limiting** can usually see:

- Authenticated tenant identity
- Subscription plan or quota tier
- Application-specific endpoint cost

It is a strong fit for:

- Fairness between tenants
- Plan-aware quotas
- Route-specific or operation-specific controls

It becomes weaker when:

- Traffic is spread across many instances
- You need hard guarantees instead of approximate protection
- A single instance restart should not reset counters

## Why a Single Layer Fails

A single edge rule will miss tenant-aware abuse when attackers rotate IPs or when legitimate traffic arrives from shared infrastructure. A single in-memory limiter will miss global coordination when requests fan out across your fleet.

This is why layered designs hold up better in practice. Use Cloudflare to shed obvious abuse early, then use tenant-aware limits in the application to enforce fairness and business policy. One layer protects infrastructure. The other protects shared product capacity.

## Choosing the Right Failure Mode

Every rate limiter eventually fails in some direction. The useful question is which failure mode is safer for the system you are building.

Edge limiting may block too broadly because IP-level signals are coarse. In-memory limiting may allow too much because local counters are fragmented. Neither is universally correct.

If your main concern is protecting compute and downstream spend, Cloudflare API-based limiting is usually the better first layer. If your main concern is isolating tenant behavior and enforcing product quotas, in-memory limiting gives you the policy surface you need, but at the cost of weaker global consistency.

For many systems, the practical answer is to combine them. Let Cloudflare reduce obvious abuse and return HTTP 429 (Too Many Requests) before requests become expensive. Let the application enforce per-tenant fairness with limits based on authenticated identity, and accept that purely in-memory storage is a trade-off unless you add shared state later.

## Conclusion

Per-tenant rate limiting is really about choosing the right identity at the right layer. Cloudflare API-based limits protect infrastructure early, while in-memory limits express tenant-aware policy with much better context. The strongest designs use both, because fairness and cost protection are related goals, but they are not the same problem.
