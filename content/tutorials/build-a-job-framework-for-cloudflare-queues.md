---
title: How to Build a Job Framework for Cloudflare Queues
excerpt: Create an abstract Job class with error classification and retry control for Cloudflare Queues.
tech: @cloudflare/workers-types@4.0.0
---

Cloudflare Queues provides automatic retries for failed jobs, but the default behavior treats all errors the same. A validation error and a network timeout both trigger retries, even though only one of them might succeed on a second attempt.

A job framework with [error classification](/tutorials/classify-errors-for-job-retry-behavior) solves this. You define custom error types that signal whether a failure should be retried or acknowledged immediately. Validation errors become non-retriable, transient failures become retriable, and your job implementations stay focused on business logic instead of retry mechanics.

## Create the Base Job Class

Start by creating an abstract `Job` class that handles the common concerns: logging, error handling, and message acknowledgment.

```ts {% path="lib/jobs.ts" %}
import type { Message } from "@cloudflare/workers-types";

export namespace Job {
	export interface RunOptions {
		message: Message<unknown>;
	}
}

export abstract class Job {
	static async run<T extends Job>(
		this: new (body: unknown) => T,
		options: Job.RunOptions,
	): Promise<void> {
		let job = new this(options.message.body);

		try {
			console.log("job.started", {
				name: this.name,
				id: options.message.id,
				attempts: options.message.attempts,
			});

			await job.perform();

			options.message.ack();

			console.log("job.completed", {
				name: this.name,
				id: options.message.id,
				attempts: options.message.attempts,
			});
		} catch (error) {
			// Error handling goes here
			throw error;
		}
	}

	constructor(protected readonly input: unknown) {}

	abstract perform(): Promise<void>;
}
```

The `run` static method is the entry point for processing a job. It instantiates the job class with the message body and handles the lifecycle: start, perform, complete, and error handling. The `perform` method is abstract, meaning each job subclass must implement its own logic.

## Define Custom Error Types for Retry Control

Add custom error classes to the `Job` class that [signal how the framework should handle failures](/tutorials/classify-errors-for-job-retry-behavior).

```ts {% path="lib/jobs.ts" %}
export abstract class Job {
	// ... previous code

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
}
```

`RetryError` tells the framework to explicitly retry the message. `NonRetriableError` tells it to acknowledge the message without retrying, useful for validation errors or other permanent failures.

## Handle Errors with Classification

Update the error handling in the `run` method to classify errors and take appropriate action.

```ts {% path="lib/jobs.ts" %}
try {
	// ... job execution
} catch (error) {
	let errorInfo = {
		name: error instanceof Error ? error.name : "UnknownError",
		message: error instanceof Error ? error.message : String(error),
	};

	if (error instanceof Job.RetryError) {
		console.log("job.retrying", {
			id: options.message.id,
			attempts: options.message.attempts,
			error: errorInfo,
		});

		return options.message.retry();
	}

	if (error instanceof Job.NonRetriableError) {
		console.log("job.non-retriable", {
			id: options.message.id,
			attempts: options.message.attempts,
			error: errorInfo,
		});

		return options.message.ack();
	}

	console.log("job.failed", {
		id: options.message.id,
		attempts: options.message.attempts,
		error: errorInfo,
	});

	throw error;
}
```

When a `RetryError` is thrown, the message is retried. When a `NonRetriableError` is thrown, the message is acknowledged and won't be retried. For any other error, the framework logs it and rethrows, letting Cloudflare Queues handle retries with its default behavior.

## Implement a Concrete Job

Now create a job that extends the base class. The job only needs to implement the `perform` method and use the custom errors when needed.

```ts {% path="app/jobs/process-order.ts" %}
import { Job } from "~/lib/jobs";
import { z } from "zod";

const schema = z.object({
	orderId: z.string(),
	customerId: z.string(),
});

export class ProcessOrderJob extends Job {
	async perform() {
		let result = schema.safeParse(this.input);

		if (!result.success) {
			throw new Job.NonRetriableError("Invalid input data", {
				cause: result.error,
			});
		}

		let { orderId, customerId } = result.data;

		let response = await fetch(`https://api.payments.com/charge`, {
			method: "POST",
			body: JSON.stringify({ orderId, customerId }),
		});

		if (!response.ok && response.status >= 500) {
			throw new Job.RetryError("Payment service unavailable");
		}

		if (!response.ok) {
			throw new Job.NonRetriableError(`Payment failed: ${response.status}`);
		}

		console.log("order.processed", { orderId, customerId });
	}
}
```

This job validates the input first. If validation fails, it throws a `NonRetriableError` because invalid data won't become valid on retry. For server errors from the payment service, it throws a `RetryError` because the service might recover. For client errors (4xx), it throws a `NonRetriableError` because the request itself is wrong.

## Process Jobs in the Queue Handler

Finally, wire up the job in your Cloudflare Queue consumer.

```ts {% path="app/queues/orders.ts" %}
import type { MessageBatch } from "@cloudflare/workers-types";
import { ProcessOrderJob } from "~/jobs/process-order";

export default {
	async queue(batch: MessageBatch) {
		for (let message of batch.messages) {
			await ProcessOrderJob.run({ message });
		}
	},
};
```

Each message in the batch is processed by calling the static `run` method on the job class. The framework handles logging, error classification, and message acknowledgment automatically.

## Final Thoughts

This pattern gives you explicit control over retry behavior without cluttering your job implementations. The base class handles cross-cutting concerns like logging and message lifecycle, while custom error types let you classify failures semantically. Jobs stay focused on business logic, and the framework ensures consistent behavior across all your background tasks. For [testability](/articles/designing-for-testability-in-serverless-functions), consider injecting dependencies through the constructor rather than importing them directly.

If you have multiple job types in a single queue, consider combining this framework with [Zod discriminated unions for type-safe message routing](/tutorials/build-a-type-safe-queue-job-system-with-zod). For tasks that need to run longer than the Worker execution limit, explore [Cloudflare Workflows for long-running tasks](/tutorials/use-cloudflare-workflows-for-long-running-tasks).
