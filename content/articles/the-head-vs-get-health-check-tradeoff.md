---
title: The HEAD vs GET Health Check Tradeoff
excerpt: Choosing between speed and thoroughness in health check requests.
---

HTTP provides two methods for retrieving resources: GET returns the full response including the body, HEAD returns only the headers. For health checks, this choice has real implications.

## What HEAD Provides

A HEAD request asks the server to respond as if it were a GET request, but without sending the response body. You get:

- Status code
- Response headers
- Content-Length (size of the body you would have received)
- Content-Type
- Cache headers
- Custom headers

You don't get the actual content.

```
HEAD /health HTTP/1.1
Host: api.example.com

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 142
X-Request-Id: abc123
```

The server processed the request. It knows what it would return. It just doesn't send the bytes.

## The Speed Advantage

HEAD requests are faster because they transfer less data. For a health endpoint returning a small JSON payload, the difference is negligible. For a page returning megabytes of HTML, images, or data, the difference matters.

Consider monitoring a large dashboard page:

```
GET /dashboard
Response: 2.3 MB, 1.2 seconds

HEAD /dashboard
Response: 0 bytes (headers only), 0.8 seconds
```

If you're checking this endpoint every 30 seconds from multiple monitoring locations, those savings add up. Less bandwidth, less processing, less load on your servers.

## The Validation Problem

HEAD can't validate content. You know the server returned 200, but you don't know what it returned.

The [status codes lie](/articles/why-status-codes-lie-in-health-checks) problem applies here. A 200 response might be:

- An error page that happens to return 200
- Cached stale content from a CDN
- A blank page from a failed render
- Completely wrong content from a misconfigured route

With GET, you can check the body. With HEAD, you're trusting the status code.

## When HEAD Makes Sense

Use HEAD when:

**You trust the status code**: The endpoint is a dedicated health check that returns appropriate status codes for all failure modes. A 200 genuinely means healthy.

**Content validation isn't possible**: The response is binary data, a file download, or something else that can't be meaningfully validated with string matching.

**Bandwidth is constrained**: You're monitoring from locations with limited connectivity, or the response is large enough that transferring it frequently is expensive.

**You're checking availability, not correctness**: You just want to know if the server responds, not whether the response is right. This is common for TCP-level monitoring wrapped in HTTP, as part of a [multi-protocol monitoring](/articles/why-multi-protocol-monitoring-matters) strategy.

## When GET Makes Sense

Use GET when:

**You need content validation**: The response should contain specific strings, valid JSON structure, or semantic content that indicates health. You can [implement content matching rules](/tutorials/implement-content-matching-rules) to automate this validation.

**The endpoint might return errors as 200**: Many applications return error pages with 200 status codes. Only body inspection catches this.

**You're monitoring user-facing pages**: Real pages that users see should be validated the same way users experience them.

**The response is small**: If the health endpoint returns 100 bytes of JSON, the overhead of GET over HEAD is meaningless.

## Server-Side Considerations

Not all servers handle HEAD requests correctly. The HTTP specification says HEAD should return the same headers as GET, but some implementations:

- Don't support HEAD at all (return 405 Method Not Allowed)
- Return different headers than GET would
- Skip processing that would happen for GET
- Return incorrect Content-Length

If your health check uses HEAD and the server doesn't implement it properly, you might get false positives or false negatives.

Test both methods against your actual endpoints:

```bash
# Compare responses
curl -I https://api.example.com/health  # HEAD
curl -i https://api.example.com/health  # GET with headers
```

The headers should match. If they don't, stick with GET.

## Framework Behavior

Some frameworks automatically handle HEAD by running the GET handler and discarding the body. This means HEAD has the same server-side cost as GET, just less network transfer.

Other frameworks let you define separate HEAD handlers that skip expensive processing. A GET to `/health` might query the database and build a response. A HEAD to `/health` might just return 200 if the process is running.

Know how your framework handles HEAD before assuming it's cheaper.

## The Practical Default

For most health checks, use GET. The bandwidth savings from HEAD are minimal for typical health endpoints, and the ability to validate content is valuable.

Reserve HEAD for specific situations:

- Large responses where bandwidth matters
- High-frequency checks where every millisecond counts
- Simple "is it responding" checks where content doesn't matter
- Endpoints you've verified handle HEAD correctly

When in doubt, GET is the safer choice. You can always switch to HEAD later if you determine content validation isn't necessary. Going the other direction means you might miss failures you were previously catching.

## Combining Both

Some monitoring strategies use both:

1. **Frequent HEAD checks**: Every 30 seconds, verify the server responds
2. **Less frequent GET checks**: Every 5 minutes, validate the content

This balances responsiveness with thoroughness. You'll know quickly if the server goes down (HEAD catches it in 30 seconds). You'll catch content issues within 5 minutes (GET validates the body).

The tradeoff is complexity. Two monitors per endpoint means more configuration, more alerts to manage, and more data to analyze. For critical endpoints, the extra coverage might be worth it. For most endpoints, a single GET check is sufficient.
