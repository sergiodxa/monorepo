---
title: Why Multi-Protocol Monitoring Matters
excerpt: Combining TCP, HTTP, and content checks to pinpoint root causes faster.
---

A single health check tells you something is wrong. Multiple health checks tell you what's wrong. The difference matters at 3 AM when you're trying to fix an outage.

## The Diagnostic Problem

Your HTTP health check fails. What broke?

- The server process crashed
- The network is unreachable
- The load balancer is misconfigured
- The application is returning errors
- The database connection is down
- The response is malformed

A single failing check gives you a starting point. It doesn't give you a diagnosis. You'll spend the first 15 minutes of your incident just figuring out where to look.

## Monitoring at Multiple Layers

Different protocols test different layers of your stack:

**TCP (Layer 4)**: Can I establish a connection to this host and port?

**HTTP (Layer 7)**: Does the application respond to requests?

**Content**: Is the response correct and complete?

Each layer builds on the previous. If TCP fails, HTTP will also fail. If HTTP fails, content validation can't run. But if TCP succeeds and HTTP fails, you've already narrowed the problem to the application layer.

## TCP Monitoring

A TCP check attempts to establish a connection to a specific host and port. It doesn't send any application data. It just confirms:

- The host is reachable over the network
- Something is listening on the specified port
- The TCP handshake completes successfully

```
TCP check to api.example.com:443
→ SYN
← SYN-ACK
→ ACK
✓ Connection established
```

If TCP fails, you know the problem is infrastructure-level:

- Server is down or unreachable
- Firewall is blocking connections
- DNS resolution failed
- Network path is broken

You don't need to look at application logs. The process isn't even receiving connections.

## HTTP Monitoring

An HTTP check sends an actual request and expects a response. It confirms:

- The web server is running
- It's accepting HTTP connections
- It can process requests and return responses
- The response has an expected status code

```
HTTP check to https://api.example.com/health
→ GET /health HTTP/1.1
← HTTP/1.1 200 OK
✓ Application responded
```

If TCP succeeds but HTTP fails, the problem is application-level:

- Web server process crashed but port is still bound
- Application is deadlocked or unresponsive
- Request processing is failing
- TLS handshake is failing

The infrastructure is fine. Something in your application stack is broken.

## Content Monitoring

A content check validates the response body, not just the status code. It confirms:

- The response contains expected data
- No error messages are present
- The application logic executed correctly
- Dependencies are functioning

```
Content check to https://api.example.com/health
→ GET /health HTTP/1.1
← HTTP/1.1 200 OK
← {"status": "healthy", "database": "connected"}
✓ Response contains expected content
```

If HTTP succeeds but content validation fails, the problem is in application logic or dependencies:

- Database queries are failing
- External APIs are unreachable
- Business logic is throwing errors
- Cached or stale data is being served

The application is running and responding. It's just not responding correctly. This is why [status codes lie](/articles/why-status-codes-lie-in-health-checks)—a 200 response doesn't guarantee your service is actually healthy.

## Combining Monitors for Diagnosis

Run all three checks against the same service. The pattern of failures tells you where to look:

| TCP | HTTP | Content | Diagnosis                                  |
| --- | ---- | ------- | ------------------------------------------ |
| ✗   | ✗    | ✗       | Infrastructure: server down, network issue |
| ✓   | ✗    | ✗       | Application: process crashed, TLS issue    |
| ✓   | ✓    | ✗       | Logic: dependency failure, bad response    |
| ✓   | ✓    | ✓       | Healthy                                    |

When you get paged, check all three monitors. If only content is failing, don't waste time checking if the server is running. Go straight to application logs and dependency status.

## Practical Implementation

Most monitoring services support multiple check types. Configure them for the same endpoint:

```yaml
monitors:
  - name: api-tcp
    type: tcp
    host: api.example.com
    port: 443
    interval: 30s

  - name: api-http
    type: http
    url: https://api.example.com/health
    expected_status: 200
    interval: 60s

  - name: api-content
    type: http
    url: https://api.example.com/health
    expected_status: 200
    expected_content: '"status":"healthy"'
    interval: 60s
```

The TCP check runs most frequently because it's cheapest. HTTP and content checks run less often because they generate actual load. When choosing between HEAD and GET for HTTP checks, consider [the HEAD vs GET health check tradeoff](/articles/the-head-vs-get-health-check-tradeoff)—HEAD is faster but can't validate content.

## Alert Routing

Different failures should route to different responders:

- **TCP failure**: Infrastructure team, likely a server or network issue
- **HTTP failure**: Platform team, likely a deployment or configuration issue
- **Content failure**: Application team, likely a code or dependency issue

This routing strategy works best when you've properly implemented [separating detection from notification](/articles/separating-detection-from-notification). The infrastructure team doesn't need to wake up for a database connection pool exhaustion. The application team doesn't need to investigate a network partition.

## Beyond Basic Checks

Multi-protocol monitoring extends to other protocols:

- **DNS**: Can the hostname be resolved?
- **TLS**: Is the certificate valid and not expiring?
- **Database**: Can you connect and run a simple query?
- **Queue**: Is the message broker accepting connections?

Each additional check narrows the diagnostic space. When something fails, you know more about what's still working.

## The Cost of Comprehensive Monitoring

More checks mean more complexity:

- More configuration to maintain
- More alerts to potentially fire
- More data to store and analyze
- More cost if using a paid service

Balance comprehensiveness against operational overhead. Start with the three core checks (TCP, HTTP, content) for critical services. Add specialized checks as you encounter diagnostic gaps.

The goal isn't to monitor everything. It's to have enough information to diagnose failures quickly. Three well-chosen checks often provide more value than a dozen poorly-chosen ones.
