---
title: How to Classify Errors for Job Retry Behavior
excerpt: Control job retry behavior by classifying errors as retriable or non-retriable.
tech: @cloudflare/workers-types@4.0.0
---

When building background jobs with Cloudflare Queues, not all errors should be treated the same. Some errors are transient: a network timeout, a rate limit, or a temporary service outage. These should trigger a retry. Other errors are permanent: invalid input data, a missing resource, or a business rule violation. Retrying these is pointless and wastes resources.

By default, Cloudflare Queues will retry any message that throws an error. This works for unexpected failures, but it doesn't give you control over which errors should retry and which should not. To solve this, you can classify errors explicitly using custom error classes. This pattern works especially well when combined with a [job framework for Cloudflare Queues](/tutorials/build-a-job-framework-for-cloudflare-queues).

## Create the Error Classes

Define two custom error classes: one for errors that should trigger a retry, and one for errors that should not.

```ts {% path="lib/jobs.ts" %}
static RetryError = class RetryError extends Error {
  override name = "RetryError";
  constructor(message = "Failed to run job. Retry.", options?: ErrorOptions) {
    super(message, options);
  }
};

static NonRetriableError = class NonRetriableError extends Error {
  override name = "NonRetriableError";
  constructor(message = "Failed to run job. Not retriable.", options?: ErrorOptions) {
    super(message, options);
  }
};
```

Both classes extend `Error` and accept an optional `options` parameter. This lets you pass a `cause` to preserve the original error for debugging.

## Handle Errors in the Job Runner

In your job runner, catch errors and check their type to decide how to handle them.

```ts {% path="lib/jobs.ts" %}
try {
	await job.perform();
	options.message.ack();
} catch (error) {
	if (error instanceof Job.RetryError) {
		console.error("job.retrying", {
			id: options.message.id,
			attempts: options.message.attempts,
			error: {
				name: error instanceof Error ? error.name : "UnknownError",
				message: error instanceof Error ? error.message : String(error),
			},
		});

		return options.message.retry();
	}

	if (error instanceof Job.NonRetriableError) {
		console.error("job.non-retriable", {
			id: options.message.id,
			attempts: options.message.attempts,
			error: {
				name: error instanceof Error ? error.name : "UnknownError",
				message: error instanceof Error ? error.message : String(error),
			},
		});

		return options.message.ack();
	}

	// Unexpected errors: let Cloudflare handle retries
	throw error;
}
```

When a `RetryError` is thrown, the job calls `message.retry()` to put it back in the queue. When a `NonRetriableError` is thrown, the job calls `message.ack()` to mark it as complete without retrying. Any other error is rethrown, letting Cloudflare's default retry behavior take over.

## Throw Retriable Errors for Transient Failures

Use `RetryError` when the failure is likely temporary and retrying might succeed.

```ts {% path="app/jobs/sync-user.ts" %}
import { Job } from "~/lib/jobs";

export class SyncUserJob extends Job {
	async perform() {
		let response = await fetch("https://api.example.com/users/sync", {
			method: "POST",
			body: JSON.stringify(this.input),
		});

		if (response.status === 429) {
			throw new Job.RetryError("Rate limited by external API");
		}

		if (response.status >= 500) {
			throw new Job.RetryError("External API returned a server error");
		}

		if (!response.ok) {
			throw new Job.NonRetriableError(`Unexpected status: ${response.status}`);
		}
	}
}
```

Rate limits (429) and server errors (5xx) are good candidates for retries. The external service might recover, and the next attempt could succeed.

## Throw Non-Retriable Errors for Permanent Failures

Use `NonRetriableError` when retrying would never succeed.

```ts {% path="app/jobs/process-payment.ts" %}
import { Job } from "~/lib/jobs";
import { z } from "zod";

let PaymentInput = z.object({
	userId: z.string(),
	amount: z.number().positive(),
});

export class ProcessPaymentJob extends Job {
	async perform() {
		let result = PaymentInput.safeParse(this.input);

		if (!result.success) {
			throw new Job.NonRetriableError("Invalid payment input", {
				cause: result.error,
			});
		}

		let user = await db.users.find(result.data.userId);

		if (!user) {
			throw new Job.NonRetriableError(`User ${result.data.userId} not found`);
		}

		// Process the payment...
	}
}
```

Validation errors and missing resources will never succeed on retry. Marking them as non-retriable prevents wasted queue cycles and keeps your logs clean.

## Preserve the Original Error with Cause

When wrapping an error, pass it as the `cause` to preserve the stack trace and original message.

```ts {% path="app/jobs/send-email.ts" %}
import { Job } from "~/lib/jobs";

export class SendEmailJob extends Job {
	async perform() {
		try {
			await emailService.send(this.input);
		} catch (error) {
			if (error instanceof EmailValidationError) {
				throw new Job.NonRetriableError("Invalid email address", {
					cause: error,
				});
			}

			throw new Job.RetryError("Email service temporarily unavailable", {
				cause: error,
			});
		}
	}
}
```

The `cause` property is logged alongside the error, making it easier to debug why a job failed.

## Final Thoughts

Classifying errors gives you explicit control over retry behavior. Use `RetryError` for transient failures like rate limits, timeouts, and temporary outages. Use `NonRetriableError` for permanent failures like validation errors, missing resources, and business rule violations. For unexpected errors, let them bubble up so the queue's default retry mechanism handles them.

This pattern keeps your job processing predictable, your logs meaningful, and your queue resources focused on work that can actually succeed. For deeper insights into this approach, see [error classification in background job systems](/articles/error-classification-in-background-job-systems). For a complete implementation, see how to [build a job framework for Cloudflare Queues](/tutorials/build-a-job-framework-for-cloudflare-queues) that uses these error classes, or add [type-safe message routing with Zod](/tutorials/build-a-type-safe-queue-job-system-with-zod) to validate and route different job types. You can also [implement retry with configurable backoff](/tutorials/implement-retry-with-configurable-backoff) for fine-grained control over retry timing.
