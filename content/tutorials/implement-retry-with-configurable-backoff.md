---
title: How to Implement Retry with Configurable Backoff
excerpt: Build a retry utility with constant, linear, and exponential backoff strategies for resilient async operations.
tech: ms@2.1.3
---

When building applications that interact with external services, network requests can fail due to temporary issues like rate limiting, server overload, or network hiccups. Instead of failing immediately, you often want to retry the operation with increasing delays between attempts.

The challenge is implementing a retry mechanism that supports different backoff strategies: constant delays for predictable timing, linear growth for gradual escalation, and exponential backoff for aggressive backing off under heavy load. You also need the ability to conditionally retry based on the error type, since not all errors are worth retrying.

## Define the Result Type

First, define a simple [Result type](/articles/result-objects-in-ts) to handle success and failure cases explicitly:

```ts {% path="lib/result.ts" %}
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export function success<T>(data: T): Result<T, never> {
	return { success: true, data };
}

export function failure<E>(error: E): Result<never, E> {
	return { success: false, error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
	return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
	return !result.success;
}
```

This [Result pattern](/articles/result-objects-in-ts) makes error handling explicit and avoids throwing exceptions.

## Define the Retry Options Interface

```ts {% path="lib/retry.ts" %}
import ms from "ms";

import type { Result } from "./result";

export namespace retry {
	export interface Options<E extends Error> {
		/** Maximum number of retry attempts */
		times: number;
		/** Delay between retries. Can be a number (ms) or a string parsed by ms (e.g. "100ms", "1s") */
		delay: number | ms.StringValue;
		/**
		 * Backoff strategy.
		 * @default "exponential"
		 */
		backoff?: "constant" | "linear" | "exponential";
		/** Optional predicate to determine if a retry should be attempted. Receives the error and attempt number. */
		when?: (error: E, attempts: number) => boolean;
	}
}
```

The options interface defines four configuration properties. The `times` property sets the maximum retry attempts. The `delay` property accepts either a number in milliseconds or a human readable string like `"100ms"` or `"1s"` using the `ms` library. The `backoff` property selects the delay strategy, defaulting to exponential. The optional `when` predicate lets you skip retries for certain error types.

## Create a Custom Retry Error

```ts {% path="lib/retry.ts" %}
export class RetryError extends Error {
	override name = "RetryError";

	constructor(attempts: number) {
		super(`Failed after ${attempts} attempts`);
	}
}
```

The `RetryError` class provides a clear signal when all retry attempts have been exhausted. It includes the number of attempts made, which helps with debugging and logging. By extending `Error` and setting a custom `name`, you can easily identify this error type when handling failures.

## Implement the Retry Function

```ts {% path="lib/retry.ts" %}
import { failure, isSuccess } from "./result";

export async function retry<T, E extends Error>(
	fn: () => Promise<Result<T, E>>,
	options: retry.Options<E>,
): Promise<Result<T, E | RetryError>> {
	if (options.times <= 0) throw new RangeError("Retry times must be greater than 0");
	if (typeof options.delay !== "number" && typeof options.delay !== "string") {
		throw new TypeError("Delay must be a number or a string");
	}

	let attempts = 0;

	while (attempts < options.times) {
		let result = await fn();
		if (isSuccess(result)) return result;
		attempts++;
		if (options.when && !options.when(result.error, attempts)) break;

		let delay: number;
		if (options.backoff === "constant") {
			if (typeof options.delay === "number") delay = options.delay;
			else if (typeof options.delay === "string") delay = ms(options.delay);
			else throw new TypeError("Delay must be a number or a string");
		}

		if (options.backoff === "linear") {
			if (typeof options.delay === "number") delay = options.delay * attempts;
			else if (typeof options.delay === "string") delay = ms(options.delay) * attempts;
			else throw new TypeError("Delay must be a number or a string");
		}

		if (options.backoff === "exponential" || !options.backoff) {
			if (typeof options.delay === "number") delay = options.delay * 2 ** (attempts - 1);
			else if (typeof options.delay === "string") delay = ms(options.delay) * 2 ** (attempts - 1);
			else throw new TypeError("Delay must be a number or a string");
		}

		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	return failure(new RetryError(attempts));
}
```

The `retry` function wraps an async function that returns a `Result` type. It validates the options upfront, then enters a loop that calls the function until it succeeds, the maximum attempts are reached, or the `when` predicate returns false.

The backoff calculation happens after each failed attempt. Constant backoff uses the same delay every time. Linear backoff multiplies the base delay by the attempt number, so delays grow steadily. Exponential backoff doubles the delay with each attempt using `2 ** (attempts - 1)`, which is the most aggressive strategy for backing off under load.

## Use Constant Backoff for Predictable Timing

```ts {% path="app/services/api.ts" %}
import { retry } from "~/lib/retry";

let result = await retry(() => fetchData(url), {
	times: 3,
	delay: "500ms",
	backoff: "constant",
});
```

Constant backoff waits the same amount of time between each retry: 500ms, 500ms, 500ms. This is useful when you need predictable timing, such as polling an endpoint that has a known recovery time.

## Use Linear Backoff for Gradual Escalation

```ts {% path="app/services/api.ts" %}
let result = await retry(() => fetchData(url), {
	times: 4,
	delay: "200ms",
	backoff: "linear",
});
```

Linear backoff increases the delay proportionally with each attempt: 200ms, 400ms, 600ms, 800ms. This provides a middle ground between constant and exponential strategies, giving the service more time to recover without waiting too long.

## Use Exponential Backoff for Heavy Load Scenarios

```ts {% path="app/services/api.ts" %}
let result = await retry(() => fetchData(url), {
	times: 5,
	delay: "100ms",
	backoff: "exponential",
});
```

Exponential backoff doubles the delay with each attempt: 100ms, 200ms, 400ms, 800ms, 1600ms. This is the default strategy and works best when dealing with rate limiting or overloaded services, as it quickly backs off to reduce pressure on the failing service.

## Filter Retries by Error Type

```ts {% path="app/services/api.ts" %}
class NetworkError extends Error {
	override name = "NetworkError";
}

class ValidationError extends Error {
	override name = "ValidationError";
}

let result = await retry(() => fetchData(url), {
	times: 5,
	delay: "1s",
	backoff: "exponential",
	when: (error) => error instanceof NetworkError,
});
```

The `when` predicate lets you retry only for specific error types. In this example, network errors trigger retries while validation errors cause an immediate exit. This prevents wasting time retrying operations that will never succeed, like invalid input data. For more on this approach, see how to [classify errors for job retry behavior](/tutorials/classify-errors-for-job-retry-behavior).

## Handle the Retry Result

```ts {% path="app/routes/data.ts" %}
import { isFailure } from "~/lib/result";
import { retry, RetryError } from "~/lib/retry";

let result = await retry(() => fetchData(url), {
	times: 3,
	delay: "100ms",
});

if (isFailure(result)) {
	if (result.error instanceof RetryError) {
		console.error(result.error.message); // "Failed after 3 attempts"
	}
	return;
}

// result.data is now typed as the success value
console.log(result.data);
```

After calling `retry`, check if the result is a failure. If the error is a `RetryError`, all attempts were exhausted. Otherwise, the `when` predicate stopped retries early. On success, the data is fully typed based on your function's return type.

## Final Thoughts

The retry utility provides a flexible way to handle transient failures in async operations. Constant backoff works for predictable recovery times, linear backoff provides gradual escalation, and exponential backoff is best for rate limiting scenarios. The `when` predicate prevents unnecessary retries for errors that will never succeed. Combined with the [Result pattern](/articles/result-objects-in-ts), this approach keeps error handling explicit and type safe throughout your application. For background job processing with Cloudflare Queues, see how to [build a job framework](/tutorials/build-a-job-framework-for-cloudflare-queues) that integrates error classification with queue-level retry handling.
