# Tutorial Template

This template demonstrates the structure and style for tutorials on sergiodxa.com.

## Frontmatter

```yaml
---
title: How to [Action] with [Technology]
tech: package@1.0.0 @scope/package@2.0.0
excerpt: [Complete sentence under 130 characters describing what the reader will accomplish.]
---
```

## Opening (1-2 paragraphs)

Describe the use case with real-world examples. What problem does this solve? What scenarios commonly require this solution?

The second paragraph can elaborate on the challenge or set up what the tutorial will cover.

## Optional TL;DR

```markdown
> TL;DR: [Here's a repository with a working example](https://github.com/sergiodxa/repo) of this tutorial.
```

## Body Sections

Each section should accomplish something specific and build on the previous section.

### Section Heading Pattern

Use action-oriented headings that describe what the reader will do:

- "Set Up the Database Connection"
- "Create the Authentication Middleware"
- "Handle Form Submissions"
- "Add Error Handling"

Avoid explanatory headings like "Understanding the Architecture" or "How It Works".

### Section Content Pattern

```ts {% path="app/example.ts" %}
import { something } from "package";

export function doSomething(input: string) {
	let result = something(input);
	return result;
}
```

Brief explanation of what this code does (1-2 sentences). Why this approach matters or what problem it solves (1-2 sentences).

## Closing Section

A brief "Final Thoughts" or conclusion section that covers:

- When to use this pattern
- Trade-offs or limitations
- Related topics (without diving into them)

## Example: Complete Tutorial

```markdown
---
title: How to Add Rate Limiting to Your API
tech: hono@4.0.0
excerpt: Protect your API endpoints from abuse by implementing token bucket rate limiting.
---

APIs without rate limiting are vulnerable to abuse. A single client can overwhelm your server with requests, affecting all users. This tutorial shows how to implement token bucket rate limiting that protects your endpoints while allowing legitimate traffic bursts.

> TL;DR: [Here's a repository with a working example](https://github.com/sergiodxa/rate-limiting-example) of this tutorial.

## Create the Rate Limiter

\`\`\`ts {% path="app/lib/rate-limiter.ts" %}
interface RateLimiter {
check(key: string): Promise<{ allowed: boolean; remaining: number }>;
}

export function createRateLimiter(limit: number, window: number): RateLimiter {
let tokens = new Map<string, { count: number; reset: number }>();

return {
async check(key: string) {
let now = Date.now();
let bucket = tokens.get(key);

      if (!bucket || bucket.reset < now) {
        bucket = { count: limit, reset: now + window };
        tokens.set(key, bucket);
      }

      if (bucket.count > 0) {
        bucket.count--;
        return { allowed: true, remaining: bucket.count };
      }

      return { allowed: false, remaining: 0 };
    },

};
}
\`\`\`

The rate limiter uses an in-memory token bucket. Each key gets a bucket with a set number of tokens that refill after the window expires.

## Add the Middleware

\`\`\`ts {% path="app/middleware/rate-limit.ts" %}
import { createMiddleware } from "hono/factory";
import { createRateLimiter } from "../lib/rate-limiter";

let limiter = createRateLimiter(100, 60_000);

export let rateLimit = createMiddleware(async (c, next) => {
let key = c.req.header("x-forwarded-for") ?? "unknown";
let result = await limiter.check(key);

c.header("X-RateLimit-Remaining", result.remaining.toString());

if (!result.allowed) {
return c.json({ error: "Too many requests" }, 429);
}

return next();
});
\`\`\`

The middleware extracts the client IP and checks the rate limiter. It adds headers so clients know their remaining quota.

## Apply to Routes

\`\`\`ts {% path="app/routes/api.ts" %}
import { Hono } from "hono";
import { rateLimit } from "../middleware/rate-limit";

let app = new Hono();

app.use("/api/\*", rateLimit);

app.get("/api/users", (c) => {
return c.json({ users: [] });
});

export default app;
\`\`\`

Apply the middleware to your API routes. All routes under `/api/*` now have rate limiting.

## Final Thoughts

Token bucket rate limiting allows short bursts while maintaining average rate limits. For production, consider using a distributed store like Redis instead of in-memory storage. You may also want different limits for authenticated versus anonymous users.
```
