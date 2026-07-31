# @pkg/jobs

Base class for background jobs running on Cloudflare Queues.

## Overview

This package provides an abstract `Job` class that handles common concerns for background jobs:

- Structured logging with batched output via `@pkg/logger`
- Automatic message acknowledgment and retry handling
- Optional uptime monitoring pings on successful completion
- Error classification for retry vs non-retriable failures

Jobs are designed for use with [Cloudflare Queues](https://developers.cloudflare.com/queues/) consumers.

## Usage

### Defining a Job

```typescript
import { Job } from "@pkg/jobs";
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";
import { z } from "zod";

export class SyncTeamJob extends Job {
	static override monitorId = "your-monitor-id"; // Optional: for uptime monitoring
	static schema = z.object({ teamId: z.string() });

	async perform() {
		let result = await validate(this.input, SyncTeamJob.schema);
		if (isFailure(result)) throw new Job.NonRetriableError("Invalid input");

		let { teamId } = result.data;

		this.logger.info("sync.started", { teamId });

		let syncResult = await syncTeam(teamId);

		if (syncResult.status === "not_found") throw new Job.NonRetriableError("Team not found");
		if (syncResult.status === "rate_limited") throw new Job.RetryError("Rate limited, retry later");

		this.logger.info("sync.completed", { teamId });
	}
}

export namespace SyncTeamJob {
	export type Input = z.infer<typeof SyncTeamJob.schema>;
}
```

### Running a Job

```typescript
import type { MessageBatch, ExecutionContext } from "@cloudflare/workers-types";

export default {
	async queue(batch: MessageBatch<SyncTeamJob.Input>, env: Env, ctx: ExecutionContext) {
		for (let message of batch.messages) {
			ctx.waitUntil(SyncTeamJob.run({ message, uptime: env.UPTIME_TOKEN }));
		}
	},
};
```

If the job class doesn't have a `static monitorId` property, the uptime ping is skipped even if a token is provided.

## API

### `Job`

Abstract base class for defining jobs.

#### `static monitorId?: string`

Optional uptime monitor ID. When defined and a token is provided to `run()`, the job will ping the uptime service on successful completion. Use `override` when defining this property in subclasses.

```typescript
class MyJob extends Job {
	static override monitorId = "abc-123";
}
```

#### `static async run(options: Job.RunOptions): Promise<void>`

Executes the job with full lifecycle management.

**Parameters:**

- `options.message`: Cloudflare Queue `Message<unknown>` object containing the job input and ack/retry control
- `options.uptime`: Optional bearer token for the uptime service (monitorId is read from the static property)

**Behavior:**

1. Creates a `BatchedLogger` with identifier `job:{job-name}:{message-id}`
2. Logs `job.started` with message ID and attempt count
3. Calls `perform()` on the job instance
4. On success: pings uptime (if configured), acks message, logs `job.completed` (with a `usage` field when a tracker is registered — see `setJobUsageTracker`)
5. On error: handles based on error type (see Error Classes below)
6. Always flushes the logger in `finally`

#### `setJobUsageTracker(tracker: Job.UsageTracker | undefined): void`

Registers a tracker that `Job.run` wraps every job's whole lifecycle in, so the app
can attribute database work to the job that caused it. When one is registered,
`job.completed` gains a `usage` field with `{ statements, rowsRead, rowsWritten,
durationMs }`; without one, jobs run exactly as before and no field is added.

The tracker owns the accumulation mechanism — this package never touches a database.
The intended shape is an async-local store fed by the database adapter's own
per-statement observer, which keeps concurrently running jobs from the same queue
batch attributed separately:

```typescript
import { Job, setJobUsageTracker } from "@pkg/jobs";
import { AsyncLocalStorage } from "node:async_hooks";

let storage = new AsyncLocalStorage<Job.Usage>();

setJobUsageTracker((usage, body, context) => {
	console.log("tracking", context.job);
	return storage.run(usage, body);
});

// Wherever the database reports a statement's cost:
function recordStatement(rowsRead: number, rowsWritten: number) {
	let usage = storage.getStore();
	if (!usage) return; // Not inside a tracked job — e.g. a request path.
	usage.statements += 1;
	usage.rowsRead += rowsRead;
	usage.rowsWritten += rowsWritten;
}
```

Call it once while the app boots, and with `undefined` to turn tracking back off.
Totals are reported on `job.completed` only — a job that retried or failed reports no
usage, since a partial total from an aborted run would be misleading.

#### `abstract perform(): Promise<void>`

Implement this method with your job logic. Access the input via `this.input` and the logger via `this.logger`.

#### `logger: BatchedLogger`

Batched logger instance for structured logging. Logs are accumulated and flushed as a single entry when the job completes.

#### `input: JSONValue`

The message body passed to the job. This is typed as `JSONValue` from `@pkg/types`, representing any JSON-serializable value. Use validation with `@pkg/validate` to parse and type the input safely.

### Error Classes

#### `Job.RetryError`

Throw when the job should be retried. Accepts an optional `ErrorOptions` object to specify a `cause`.

```typescript
throw new Job.RetryError("External service unavailable");

// With cause for debugging
throw new Job.RetryError("Failed to fetch data", { cause: originalError });
```

Logs `job.retrying` at error level, then calls `message.retry()`.

#### `Job.NonRetriableError`

Throw when the job failed but should not be retried. Accepts an optional `ErrorOptions` object to specify a `cause`.

```typescript
throw new Job.NonRetriableError("Invalid input data");

// With cause for debugging
throw new Job.NonRetriableError("Validation failed", { cause: validationError });
```

Logs `job.non-retriable` at error level, then calls `message.ack()`.

### Types

#### `Job.RunOptions`

```typescript
interface RunOptions {
	message: Message<unknown>;
	uptime?: string; // Bearer token for uptime service
}
```

#### `Job.Usage`

```typescript
interface Usage {
	statements: number;
	rowsRead: number;
	rowsWritten: number;
	durationMs: number;
}
```

#### `Job.UsageTracker`

```typescript
type UsageTracker = <T>(usage: Usage, body: () => Promise<T>, context: UsageContext) => Promise<T>;
```

#### `Job.UsageContext`

```typescript
interface UsageContext {
	/** Stable kebab-case identifier for the job class, e.g. `check-http-job`. */
	job: string;
}
```

A tracker that only counts can ignore it; one that attributes what it counted needs to be
able to say what the work was.

#### `Job.ConstructorOptions`

```typescript
interface ConstructorOptions {
	uptime?: {
		token?: string;
		monitorId?: string;
	};
	logger: BatchedLogger;
}
```

## Pattern: Job with Validation (Recommended)

Validate input using `@pkg/validate` to parse and type the input safely. Throw `NonRetriableError` for invalid data.

```typescript
import { Job } from "@pkg/jobs";
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";
import { z } from "zod";

class ProcessTeamJob extends Job {
	static schema = z.object({
		teamId: z.string().uuid(),
		action: z.enum(["sync", "delete"]),
	});

	async perform(): Promise<void> {
		let result = await validate(this.input, ProcessTeamJob.schema);

		if (isFailure(result)) {
			throw new Job.NonRetriableError("Invalid input data", { cause: result.error });
		}

		let { teamId, action } = result.data;
		// result.data is fully typed as { teamId: string; action: "sync" | "delete" }
	}
}
```

## Pattern: Job with External API Calls

Handle transient failures with `RetryError`.

```typescript
import { Job } from "@pkg/jobs";
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";
import { z } from "zod";

class FetchDataJob extends Job {
	static schema = z.object({ url: z.string().url() });

	async perform(): Promise<void> {
		let result = await validate(this.input, FetchDataJob.schema);

		if (isFailure(result)) {
			throw new Job.NonRetriableError("Invalid input", { cause: result.error });
		}

		let response = await fetch(result.data.url);

		if (response.status === 429) throw new Job.RetryError("Rate limited");
		if (response.status === 404) throw new Job.NonRetriableError("Resource not found");
		if (response.ok === false) throw new Job.RetryError(`HTTP ${response.status}`);

		let data = await response.json();
		this.logger.info("data.fetched", { size: JSON.stringify(data).length });
	}
}
```

## Pattern: Job with Database Operations

```typescript
import { Job } from "@pkg/jobs";
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";
import { z } from "zod";
import { db } from "~/db";

class CleanupJob extends Job {
	static schema = z.object({ olderThanDays: z.number().int().positive() });

	async perform(): Promise<void> {
		let result = await validate(this.input, CleanupJob.schema);

		if (isFailure(result)) {
			throw new Job.NonRetriableError("Invalid input", { cause: result.error });
		}

		let cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - result.data.olderThanDays);

		let deleted = await db
			.delete(records)
			.where(lt(records.createdAt, cutoff))
			.returning({ id: records.id });

		this.logger.info("cleanup.completed", { deletedCount: deleted.length });
	}
}
```

## Related Packages

- [`@pkg/logger`](/packages/logger) - Batched logging for Cloudflare Workers
- [`@pkg/result`](/packages/result) - Result type for explicit error handling
- [`@pkg/validate`](/packages/validate) - Standard Schema validation utilities
- [`@pkg/types`](/packages/types) - Shared TypeScript types including `JSONValue`

## Tips

1. **Use `waitUntil` for the caller** - Call `ctx.waitUntil(Job.run(...))` to run jobs without blocking the queue consumer response.
2. **Define schema as static property** - Use `static schema = z.object({...})` on your job class, then access it internally with `MyJob.schema` for validation.
3. **Validate input with `@pkg/validate`** - Since `input` is `JSONValue`, use validation to parse and type it safely. This also handles malformed messages gracefully.
4. **Prefer `NonRetriableError` for bad input** - Invalid data won't become valid on retry; ack the message and move on.
5. **Log context in `perform()`** - The logger automatically includes message ID and attempts; add job-specific context like entity IDs.
6. **Uptime pings only on success** - Failed jobs don't ping, so your uptime monitor will alert if jobs consistently fail.
7. **Unexpected errors re-throw** - Errors that aren't `RetryError` or `NonRetriableError` propagate to Cloudflare for default retry handling.
8. **Use `static override monitorId`** - When defining monitorId on a job class, use `override` to indicate you're overriding the base class property.
