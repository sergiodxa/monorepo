---
title: Error Classification in Background Job Systems
excerpt: Classifying errors by retry behavior improves job system reliability and prevents wasted resources.
technologies: @cloudflare/workers-types@4.0.0
---

A failed job is not just a failed job. The error that caused the failure carries information about what went wrong and, more importantly, what should happen next. Treating all errors the same way leads to wasted resources, cascading failures, and frustrated users waiting for something that will never succeed. For a practical implementation, see the tutorial on [classifying errors for job retry behavior](/tutorials/classify-errors-for-job-retry-behavior).

## The Problem with Generic Error Handling

Most job systems have a simple retry mechanism: if a job fails, retry it a few times before giving up. This works for transient failures like network timeouts or temporary service unavailability. But what happens when the error is permanent?

Consider a job that processes user uploads. If the file is corrupted, retrying won't fix it. The job will fail, retry, fail again, retry again, and eventually exhaust its retry budget. Meanwhile, the queue backs up, resources are consumed, and the user never gets a meaningful error message.

The solution is to classify errors based on their nature and handle each category differently.

## Three Categories of Errors

Errors in job systems fall into three categories: retriable, non-retriable, and unknown.

### Retriable Errors

Retriable errors are temporary failures that may succeed on subsequent attempts. These include network timeouts, rate limits, temporary service unavailability, and database connection issues.

When a job encounters a retriable error, it should be placed back in the queue for another attempt. The job system should track the number of attempts and eventually give up if the error persists, but the initial assumption is that the operation can succeed.

```ts
class RetryError extends Error {
	override name = "RetryError";
	constructor(message = "Failed to run job. Retry.", options?: ErrorOptions) {
		super(message, options);
	}
}
```

Throwing this error signals to the job runner that the failure is temporary. The runner can then call the appropriate method to requeue the message.

### Non-Retriable Errors

Non-retriable errors are permanent failures that will never succeed regardless of how many times you retry. These include validation errors, missing resources, permission denials, and malformed input data.

When a job encounters a non-retriable error, it should be acknowledged immediately and removed from the queue. Retrying would waste resources and delay other jobs.

```ts
class NonRetriableError extends Error {
	override name = "NonRetriableError";
	constructor(message = "Failed to run job. Not retriable.", options?: ErrorOptions) {
		super(message, options);
	}
}
```

The key insight is that acknowledging a failed job is not the same as succeeding. It means the job system has handled the error appropriately. The job might log the failure, notify the user, or trigger a compensating action, but it won't retry.

### Unknown Errors

Unknown errors are unexpected failures that the job code didn't anticipate. These could be bugs, unhandled edge cases, or failures in dependencies.

The safest approach for unknown errors is to let the job system's default retry mechanism handle them. If the error is actually transient, the retry might succeed. If it's permanent, the job will eventually exhaust its retry budget and be moved to a dead letter queue for investigation.

```ts
try {
	await job.perform();
	message.ack();
} catch (error) {
	if (error instanceof RetryError) {
		return message.retry();
	}

	if (error instanceof NonRetriableError) {
		return message.ack();
	}

	// Unknown error: let the system handle it
	throw error;
}
```

By re-throwing unknown errors, you delegate the decision to the job system. This is important because the system might have better visibility into the overall health of the queue and can make smarter decisions about retries.

## Practical Classification Guidelines

Classifying errors correctly requires understanding the failure modes of your dependencies.

**Mark as retriable:**

- HTTP 429 (Too Many Requests) responses
- HTTP 503 (Service Unavailable) responses
- Database connection timeouts
- Network errors during external API calls
- Lock contention or deadlock errors

**Mark as non-retriable:**

- HTTP 400 (Bad Request) responses
- HTTP 404 (Not Found) responses
- Validation failures on input data
- Authentication or authorization errors
- Business logic violations

**Leave as unknown:**

- Unexpected exceptions from libraries
- Null pointer errors or type errors
- Any error you haven't explicitly handled

The goal is not to classify every possible error upfront. Start with the errors you encounter most frequently and expand your classification as you learn more about your system's failure modes.

## Impact on System Reliability

Proper error classification has a compounding effect on system reliability.

First, it reduces queue congestion. Non-retriable jobs are removed immediately instead of occupying queue slots for multiple retry attempts. This keeps the queue healthy and ensures retriable jobs get processed quickly.

Second, it improves observability. When you log errors with their classification, you can build dashboards that distinguish between transient failures (expected) and permanent failures (require attention). A spike in non-retriable errors might indicate a bug in the producer, while a spike in retriable errors might indicate a downstream service issue.

Third, it enables better alerting. You can alert on non-retriable errors immediately since they often indicate data quality issues or bugs. Retriable errors only need attention if they persist beyond the retry budget.

Fourth, it preserves the cause chain. By wrapping the original error in your classified error type, you maintain the full context of what went wrong. This is invaluable for debugging.

```ts
try {
	await externalService.process(data);
} catch (error) {
	if (error instanceof ValidationError) {
		throw new NonRetriableError("Invalid data from external service", { cause: error });
	}
	throw new RetryError("External service temporarily unavailable", { cause: error });
}
```

## The Cost of Getting It Wrong

Misclassifying errors has real consequences.

If you mark a retriable error as non-retriable, you give up too early. A temporary network issue becomes a permanent failure, and the user's request is lost.

If you mark a non-retriable error as retriable, you waste resources. The job retries repeatedly, consuming queue capacity and potentially triggering rate limits on downstream services.

If you leave too many errors as unknown, you lose control. The job system's default behavior might not match your requirements, and you'll have a harder time understanding why jobs fail.

The right balance depends on your system's requirements. If losing a job is expensive, err on the side of retrying. If queue throughput is critical, be aggressive about marking errors as non-retriable.

## Conclusion

Error classification is a form of domain knowledge encoded in your job system. It captures your understanding of which failures are temporary, which are permanent, and which require human investigation.

The implementation is straightforward: define error classes for each category, throw the appropriate error type in your job code, and handle each category differently in your job runner. For a complete example of building a job system with this pattern, see [building a job framework for Cloudflare Queues](/tutorials/build-a-job-framework-for-cloudflare-queues). The hard part is building the knowledge of how to classify each error, and that comes from operating your system and learning from its failures.
