---
title: The BatchedLogger Pattern for Workers
excerpt: Consolidate all logs from a single request into one structured entry for better observability.
technologies: @cloudflare/workers-types@4.0.0
---

Serverless platforms like Cloudflare Workers have a unique constraint: each request runs in an isolated execution context with limited CPU time. Every `console.log` call during that execution becomes a separate log entry in your observability platform. This creates noise, makes debugging harder, and can increase costs if you're paying per log line.

The BatchedLogger pattern solves this by accumulating log entries throughout the request lifecycle and flushing them all at once as a single structured log entry. For a comparison with traditional immediate logging, see [two logger strategies: immediate vs batched](/articles/immediate-vs-batched-logger-strategies).

## The Problem with Traditional Logging

In a traditional server environment, you might log multiple times during a request:

```ts
console.log("User authenticated", { userId: "123" });
console.log("Fetching user data");
console.log("User data fetched", { duration: 45 });
console.log("Rendering response");
```

Each of these becomes a separate log entry. In your log aggregation tool, you now have four entries to correlate. If you're debugging an issue, you need to filter by request ID, timestamp, or some other identifier to see the full picture.

In Workers, this problem is amplified. The execution context is short-lived, and you often want to see everything that happened during a single invocation in one place.

## Accumulate, Then Flush

The BatchedLogger pattern is simple: instead of logging immediately, you accumulate log entries in memory and flush them all at the end of the request.

```ts
export class BatchedLogger {
	private entries = new Set<Log.Entry>();

	constructor(private readonly identifier: string) {}

	info(event: string, payload?: Log.Payload) {
		this.entries.add({ level: "info", event, payload });
	}

	error(event: string, payload?: Log.Payload) {
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

The `identifier` is a string that helps you identify the context: a request method and URL, a workflow name and ID, a cron job identifier, etc.

When you call `flush()`, all accumulated entries are output as a single log call. The logger checks if any entry has an error level and uses `console.error` accordingly, ensuring your error tracking tools pick it up correctly.

## Using It in Practice

For HTTP requests, you can create a logger from the Request object:

```ts
let logger = BatchedLogger.fromRequest(request);
// Creates identifier like "POST /api/users"
```

Throughout your request handler, you log events as they happen:

```ts
logger.info("auth.verified", { userId: user.id });
logger.info("data.fetched", { records: 42, duration: 120 });
logger.error("validation.failed", { field: "email" });
```

At the end of the request, you flush:

```ts
logger.flush();
```

The output is a single log entry:

```json
{
	"timestamp": 1708012800000,
	"events": [
		{ "level": "info", "event": "auth.verified", "userId": "123" },
		{ "level": "info", "event": "data.fetched", "records": 42, "duration": 120 },
		{ "level": "error", "event": "validation.failed", "field": "email" }
	]
}
```

## Benefits of This Approach

**Reduced log volume**: Instead of N log entries per request, you have one. This matters when you're paying per log line or have ingestion limits.

**Better correlation**: Everything that happened during a request is in one place. No need to filter or search for related entries.

**Structured data**: The output is a JSON object with all events, making it easy to query and analyze in your observability platform.

**Automatic error escalation**: If any event during the request was an error, the entire log entry is marked as an error. This ensures your alerting catches it without needing to scan individual entries.

**Clear request boundaries**: The identifier tells you exactly what context produced these logs. For HTTP requests, you see the method and URL. For workflows, you see the workflow name and execution ID.

## When to Flush

The flush should happen at the end of the execution context. For HTTP requests, this is typically in a middleware that wraps your handler:

```ts
async function handleRequest(request: Request) {
	let logger = BatchedLogger.fromRequest(request);

	try {
		return await handler(request, logger);
	} finally {
		logger.flush();
	}
}
```

The `finally` block ensures the flush happens even if the handler throws an error. This is important because error scenarios are exactly when you need the logs most.

For other contexts like Durable Objects, Workflows, or Cron triggers, you follow the same pattern: create the logger at the start, pass it through your code, and flush at the end. This pairs well with [building a multi-handler Cloudflare Worker](/tutorials/build-a-multi-handler-cloudflare-worker) where each handler type can have its own logging context.

## Trade-offs

This pattern works best when you want a complete picture of what happened during an execution. It's less suitable if you need real-time log streaming or if your execution context is very long-lived.

For long-running processes, you might want to flush periodically rather than only at the end. You could extend the pattern to flush every N entries or every N seconds while still maintaining the batching benefits.

The pattern also assumes your log entries fit comfortably in memory. For most Workers use cases, this is fine since execution contexts are short and log volumes are reasonable. If you're logging megabytes of data per request, you have bigger problems to solve first.

## Conclusion

The BatchedLogger pattern is a small change in how you think about logging, but it makes a significant difference in serverless environments. By accumulating logs and flushing them as a single structured entry, you get cleaner observability, easier debugging, and potentially lower costs.

The implementation is straightforward: a class that collects entries and outputs them all at once. The key insight is recognizing that in short-lived execution contexts, you don't need to log immediately. You can wait until the end and produce one comprehensive log entry that tells the full story.
