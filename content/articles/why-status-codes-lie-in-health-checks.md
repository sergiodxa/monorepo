---
title: Why Status Codes Lie in Health Checks
excerpt: A 200 response doesn't mean your service is healthy.
---

HTTP 200 means "OK." The server received your request, processed it, and returned a response. Everything worked, right?

Not necessarily. A 200 status code tells you the HTTP transaction succeeded. It says nothing about whether the response contains what you expected.

## The Gap Between Protocol and Application

HTTP status codes operate at the protocol level. They indicate whether the request/response cycle completed according to HTTP semantics. Application-level correctness is a separate concern entirely.

Your monitoring system pings `/health` and gets a 200. It marks the service as healthy. Meanwhile:

- The response body is an error page
- The content is cached from three days ago
- The page rendered but with no data
- A CDN is serving a fallback while your origin is down

In each case, HTTP worked perfectly. Your application did not.

## Error Pages That Return 200

This is surprisingly common. A framework catches an exception, renders a friendly error page, and returns it with a 200 status code.

```html
HTTP/1.1 200 OK Content-Type: text/html

<html>
	<body>
		<h1>Something went wrong</h1>
		<p>Please try again later.</p>
	</body>
</html>
```

The server didn't crash. It handled the error gracefully. From HTTP's perspective, this is a successful response. From the user's perspective, the feature is broken.

Some frameworks do this by default. Some developers add catch-all error handlers that swallow exceptions and return friendly messages. The intent is good: don't show ugly stack traces to users. The side effect is that monitoring systems can't detect failures.

## Cached Stale Content

CDNs and reverse proxies cache responses to reduce origin load. When configured aggressively, they might serve stale content long after it should have expired.

Your origin server is down. The CDN has a cached copy from yesterday. Users see content, so they don't complain immediately. Your health check gets a 200 from the CDN. Everything looks fine.

Hours later, someone notices the data is stale. The origin has been down the whole time. Your monitoring never caught it because the CDN kept returning 200s with cached content.

## Blank Pages from Failed Renders

Single-page applications are particularly prone to this. The server returns the HTML shell with a 200. JavaScript is supposed to fetch data and render the UI. If the data fetch fails, the page might render empty or with a loading spinner that never resolves.

```html
HTTP/1.1 200 OK Content-Type: text/html

<html>
	<body>
		<div id="app"></div>
		<script src="/bundle.js"></script>
	</body>
</html>
```

The HTML arrived successfully. The JavaScript loaded. The API call to fetch user data failed silently. The user sees a blank page. Your health check sees a 200.

Server-side rendered applications can have similar issues. The template renders, but the data injection fails. You get a page with the layout but empty content areas.

## CDN Fallbacks Serving Wrong Content

Some CDN configurations include fallback behaviors for when the origin is unreachable. Instead of returning a 502 or 503, they serve a static fallback page.

This might be intentional: show users something rather than an error. But it breaks monitoring assumptions. The fallback page returns 200. Your health check passes. The origin is completely down.

Worse, the fallback might be for a different page entirely. A misconfigured CDN rule might serve your homepage when any page fails. Users requesting `/api/users` get your marketing homepage with a 200 status.

## Content Validation

The solution is to validate response content, not just status codes.

```python
response = requests.get("https://example.com/health")

# Status code check (necessary but not sufficient)
assert response.status_code == 200

# Content validation (the actual health check)
data = response.json()
assert data["status"] == "healthy"
assert "database" in data["checks"]
assert data["checks"]["database"]["connected"] == True
```

For HTML pages, you might check for specific content:

```python
response = requests.get("https://example.com/dashboard")

assert response.status_code == 200
assert "Dashboard" in response.text
assert "Error" not in response.text
assert "Something went wrong" not in response.text
```

## Keyword Validation

Many monitoring services support keyword validation: check that specific strings appear (or don't appear) in the response. You can [implement content matching rules](/tutorials/implement-content-matching-rules) to automate this validation.

**Positive keywords** (must be present):

- Your application name or branding
- Expected page titles
- Specific data that should always appear

**Negative keywords** (must be absent):

- "Error"
- "Exception"
- "Something went wrong"
- "Please try again"
- "Under maintenance"

This catches the error-page-with-200 problem. The page might return 200, but if it contains "Something went wrong," the health check fails.

## Structured Health Endpoints

The most robust approach is a dedicated health endpoint that returns structured data:

```json
{
	"status": "healthy",
	"version": "1.2.3",
	"timestamp": "2024-01-15T10:30:00Z",
	"checks": {
		"database": { "status": "connected", "latency_ms": 5 },
		"cache": { "status": "connected", "latency_ms": 1 },
		"external_api": { "status": "reachable", "latency_ms": 150 }
	}
}
```

Your monitoring validates:

1. Status code is 200
2. Response is valid JSON
3. `status` field equals "healthy"
4. All dependency checks pass
5. Latencies are within acceptable ranges

This approach can't be fooled by error pages or cached content. The health endpoint either returns the expected structure with passing checks, or it doesn't. This structured response also enables [the three states of service health](/articles/the-three-states-of-service-health)—healthy, degraded, and down—rather than binary up/down monitoring.

## Defense in Depth

Combine multiple validation strategies:

1. **Status code**: First line of defense, catches obvious failures
2. **Response time**: Catches degraded performance
3. **Content type**: Ensures you're getting JSON/HTML as expected
4. **Body validation**: Confirms the content is correct
5. **Semantic checks**: Validates the meaning of the response

Each layer catches problems the others might miss. Status codes catch crashes. Response time catches slowdowns. Content validation catches application-level failures. This defense-in-depth approach is the foundation of [multi-protocol monitoring](/articles/why-multi-protocol-monitoring-matters), where TCP, HTTP, and content checks work together to pinpoint root causes faster.
