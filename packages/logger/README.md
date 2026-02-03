# @pkg/logger

Structured logging for Cloudflare Workers and other runtimes.

## Installation

```bash
bun add @pkg/logger
```

## Usage

```typescript
import { logger } from "@pkg/logger";

// Basic event logging
logger.info("user_subscribed");

// With additional context
logger.info("user_subscribed", {
	email: "user@example.com",
	source: "homepage",
	campaign: "launch",
});

// Warning level
logger.warn("rate_limit_approaching", { current: 90, limit: 100 });

// Error level
logger.error("api_failure", { service: "external-api", status: 500 });
```

## Output Format

Each log call outputs a structured object:

```javascript
{
  email: "user@example.com",
  source: "homepage",
  event: "user_subscribed",
  timestamp: 1738590000000
}
```

The `event` and `timestamp` fields are always added and will override any same-named properties in the payload.

## API

### `logger.info(event: string, payload?: Record<string, unknown>)`

Logs at info level using `console.info`.

### `logger.warn(event: string, payload?: Record<string, unknown>)`

Logs at warn level using `console.warn`.

### `logger.error(event: string, payload?: Record<string, unknown>)`

Logs at error level using `console.error`.

## Cloudflare Workers

This logger is designed to work with Cloudflare Workers Logs. The structured output format allows for easy filtering and searching in the Cloudflare dashboard.

Cloudflare Workers automatically captures:

- Request ID (via `cf-ray` header)
- Request method, URL, pathname
- Response status and duration
- Subrequest durations (fetch calls)

This logger complements that by adding application-level event tracking.
