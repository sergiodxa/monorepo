---
title: Immediate vs Batched Logger Strategies
excerpt: Immediate logging gives real time visibility while batched logging produces cleaner output.
technologies: @cloudflare/workers-types@4.0.0
---

Logging in serverless environments presents a unique challenge. Each request or execution context generates multiple log entries, and how you output those logs affects both debugging experience and log management costs.

There are two fundamental approaches: immediate logging and batched logging. Each serves different needs, and understanding when to use each can significantly improve your observability strategy.

## Immediate Logging

The immediate logger outputs each log call directly to the console as it happens. This is the traditional approach most developers are familiar with.

```ts
export class Logger {
	private createLogData(event: string, payload?: Record<string, unknown>) {
		return { ...payload, event, timestamp: Date.now() };
	}

	info(event: string, payload?: Record<string, unknown>) {
		console.info(this.createLogData(event, payload));
	}

	error(event: string, payload?: Record<string, unknown>) {
		console.error(this.createLogData(event, payload));
	}
}
```

Each call to `info` or `error` produces a separate log entry immediately. If you log three events during a request, you get three separate log lines in your output.

This approach works well for scenarios where you need real time visibility into what's happening. Cron jobs, background tasks, and error handling in entry points benefit from immediate logging because you want to see progress as it happens.

The downside is that your logs become scattered. A single request might produce dozens of log entries, and correlating them requires additional tooling or careful use of request IDs.

## Batched Logging

The batched logger takes a different approach: it accumulates log entries throughout an execution context and outputs them all at once when flushed. For a detailed implementation, see [the BatchedLogger pattern for Workers](/articles/the-batchedlogger-pattern-for-workers).

```ts
export class BatchedLogger {
	static fromRequest(request: Request): BatchedLogger {
		return new BatchedLogger(`${request.method} ${request.url}`);
	}

	private entries = new Set<{ level: string; event: string; payload?: Record<string, unknown> }>();

	constructor(private readonly identifier: string) {}

	info(event: string, payload?: Record<string, unknown>) {
		this.entries.add({ level: "info", event, payload });
	}

	error(event: string, payload?: Record<string, unknown>) {
		this.entries.add({ level: "error", event, payload });
	}

	flush() {
		if (this.entries.size === 0) return;

		let output = { timestamp: Date.now(), events: this.events };

		if (this.hasError) console.error(this.identifier, output);
		else console.info(this.identifier, output);

		this.entries.clear();
	}
}
```

Instead of producing multiple log lines, you get a single consolidated entry containing all events from that execution context. The identifier (like `POST /api/users`) makes it easy to find logs for specific requests.

One clever detail: the logger checks if any error was logged and uses `console.error` for the entire batch if so. This ensures error logs are properly categorized in log aggregation tools even when mixed with info level events.

## When to Use Each

The choice between immediate and batched logging depends on your context and what you're optimizing for.

**Use immediate logging when:**

- Running cron jobs or scheduled tasks where you want to see progress
- Handling errors in entry points before the request context is established
- Debugging locally and need to see logs as they happen
- Working with long running processes where waiting for a batch would delay visibility

**Use batched logging when:**

- Processing HTTP requests in serverless environments
- You want cleaner log output with one entry per request
- Log aggregation costs are a concern (fewer entries means lower costs)
- You need all context from a request in a single searchable entry

## The Trade Off: Visibility vs Cleanliness

Immediate logging gives you real time visibility at the cost of scattered output. You see each event as it happens, which is valuable during development or when debugging issues in production. But correlating events from the same request requires additional effort.

Batched logging produces cleaner output at the cost of delayed visibility. You don't see anything until the execution completes and flush is called. If a request hangs or crashes before flushing, you lose all accumulated logs from that context.

In Cloudflare Workers specifically, batched logging aligns well with the execution model. Each request is isolated, and consolidating all logs into a single entry makes it easier to analyze request behavior. The identifier pattern (`POST /api/users`) provides immediate context about what the log entry represents. When [building a multi-handler Worker](/tutorials/build-a-multi-handler-cloudflare-worker), each handler type benefits from its own logging strategy.

## A Practical Approach

In practice, you might use both strategies in the same application. The batched logger handles HTTP requests through middleware that creates the logger at the start and flushes it at the end. The immediate logger handles everything else: cron jobs, error boundaries, and initialization code.

```ts
// For HTTP requests
let logger = BatchedLogger.fromRequest(request);
logger.info("auth.validated", { userId: user.id });
logger.info("data.fetched", { count: items.length });
logger.flush(); // Single log entry with both events

// For cron jobs
let logger = new Logger();
logger.info("cron.started", { job: "cleanup" });
// Logs immediately, visible in real time
```

The key is matching the logging strategy to the execution context. Requests benefit from batching because they're discrete units of work. Background tasks benefit from immediate logging because they're ongoing processes where real time visibility matters.

## Conclusion

Neither approach is universally better. Immediate logging prioritizes real time visibility and simplicity. Batched logging prioritizes clean output and cost efficiency. Understanding both strategies lets you choose the right tool for each situation in your application.
