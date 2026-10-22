# @sdxc/result

Result type for error handling: success and failure as values, explicit in every function signature.

## Installation

```sh
npm add @sdxc/result
```

## Usage

### Return a Result

```typescript
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

function divide(a: number, b: number): Result<number, Error> {
	if (b === 0) return failure(new Error("Division by zero"));
	return success(a / b);
}
```

### Read it

Narrow with a type guard, map both cases with `match`, or take the value with `unwrap`.

```typescript
import { isSuccess, match, unwrap } from "@sdxc/result";

let result = divide(10, 2);

if (isSuccess(result)) console.log(result.data); // 5
else console.error(result.error.message);

let label = match(result, {
	success: (value) => `= ${value}`,
	failure: (error) => `failed: ${error.message}`,
});

let value = unwrap(divide(1, 0), () => 0); // 0
```

### Wrap code that throws

```typescript
import { wrap } from "@sdxc/result";

let parsed = wrap(() => JSON.parse(input)); // Result<any, Error>
let body = await wrap(() => fetch(url).then((response) => response.json())); // async too
```

### Retry a failing operation

```typescript
import { retry } from "@sdxc/result";

let result = await retry(() => wrap(() => fetch(url)), { times: 3, delay: 100 });
```

## API

### `success<T>(data: T): Success<T>`

A Success holding `data`, with `status` typed as the literal `"success"` that `Result` narrows on.

### `failure<E extends Error>(error: E): Failure<E>`

A Failure holding `error`. The error's own class stays in the type, so a custom subclass reaches every handler.

### `isSuccess(result): result is Success<T>` and `isFailure(result): result is Failure<E>`

Type guards, equivalent to `result.status === "success"` and `result.status === "failure"`.

### `succeeded(result, message?): asserts result is Success<T>`

Narrows `result` to a Success for the rest of the scope. On a Failure it throws `new Error(message, { cause: result.error })`; `message` defaults to `"Result is a failure"`.

### `failed(result, message?): asserts result is Failure<E>`

The mirror of `succeeded`: on a Success it throws with the data as `cause`; `message` defaults to `"Result is a success"`.

### `unwrap(result, fallback?: (error: E) => T): T`

The success data. On a Failure it answers `fallback(error)`, or throws the error when there is no fallback. Given a `Promise<Result>`, it answers a `Promise<T>`.

```typescript
let user = unwrap(await loadUser(id));
// same as
let result = await loadUser(id);
if (isFailure(result)) throw result.error;
let user = result.data;
```

### `match(result, { success, failure }): R`

Calls `success(data)` or `failure(error)` and answers what the handler returns. Given a `Promise<Result>`, it answers a `Promise<R>`.

### `wrap<T>(fn: () => T): wrap.ReturnType<T>`

Runs `fn` and answers its value as a Success, or what it throws as a Failure. An `fn` returning a promise answers a `Promise<Result>` that captures the rejection. A synchronous throw of a non-`Error` value becomes `new Error(String(value))`.

```typescript
let result = wrap(() => JSON.parse(input));
// same as
let result: Result<any, Error>;
try {
	result = success(JSON.parse(input));
} catch (error) {
	result = failure(error instanceof Error ? error : new Error(String(error)));
}
```

### `retry<T, E>(fn: () => Promise<Result<T, E>>, options: retry.Options<E>): Promise<Result<T, E | RetryError>>`

Calls `fn` until it answers a Success, waiting between attempts. When the attempts run out, or `when` declines an error, it answers a Failure holding a `RetryError`.

- `times`: maximum number of attempts; `0` or less throws a `RangeError`.
- `delay`: milliseconds between attempts, or a function of the failures so far (from 1) answering the milliseconds to wait.
- `backoff`: `"constant"`, `"linear"` or `"exponential"` (the default, doubling every retry), applied to a numeric `delay`.
- `when`: `(error, attempts) => boolean`; `false` stops retrying.

### `partition<T, E>(results: Result<T, E>[]): [T[], E[]]`

Splits Results into the success values and the failure errors, each in input order.

### `RetryError`

The error in `retry`'s final Failure, with the message `Failed after <n> attempts`.

### Types

#### `Result<T, E extends Error>`

`Success<T> | Failure<E>`, discriminated on `status`.

#### `Success<T>`

`{ status: "success"; data: T }`.

#### `Failure<E extends Error>`

`{ status: "failure"; error: E }`.

#### `retry.Options<E>`

The `times`, `delay`, `backoff` and `when` fields `retry` takes.

#### `wrap.ReturnType<T>`

What `wrap` answers for a function returning `T`: `Promise<Result<U, Error>>` for a promise of `U`, `Result<T, Error>` otherwise.

## Pattern: Chain steps that can fail

Give every step the same `Result` shape and return each failure as soon as it appears; the happy path runs straight down.

```typescript
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

interface Order {
	id: string;
	quantity: number;
}

function parseOrder(json: string): Result<unknown, Error> {
	return wrap(() => JSON.parse(json));
}

function validateOrder(data: unknown): Result<Order, Error> {
	if (typeof data !== "object" || data === null || !("id" in data) || !("quantity" in data)) {
		return failure(new Error("Invalid order"));
	}
	return success(data as Order);
}

async function saveOrder(order: Order): Promise<Result<Order, Error>> {
	return await wrap(() => db.orders.insert(order));
}

async function placeOrder(json: string): Promise<Result<Order, Error>> {
	let parsed = parseOrder(json);
	if (isFailure(parsed)) return parsed;

	let validated = validateOrder(parsed.data);
	if (isFailure(validated)) return validated;

	return await saveOrder(validated.data);
}
```

## Pattern: Map error types to responses

Give each failure mode its own `Error` subclass; the union grows as steps compose, and `match` turns it into a response without parsing messages.

```typescript
import type { Result } from "@sdxc/result";

import { failure, isFailure, match, success } from "@sdxc/result";

class ValidationError extends Error {
	constructor(
		readonly field: string,
		message: string,
	) {
		super(message);
	}
}

class DeliveryError extends Error {}

function validateEmail(email: string): Result<string, ValidationError> {
	if (!email.includes("@")) return failure(new ValidationError("email", "Invalid email"));
	return success(email);
}

async function sendWelcome(email: string): Promise<Result<void, DeliveryError>> {
	let response = await fetch("https://mail.example.com/send", { method: "POST", body: email });
	if (!response.ok) return failure(new DeliveryError(`Mail API answered ${response.status}`));
	return success(undefined);
}

async function subscribe(email: string): Promise<Result<void, ValidationError | DeliveryError>> {
	let validated = validateEmail(email);
	if (isFailure(validated)) return validated;
	return await sendWelcome(validated.data);
}

async function handle(request: Request): Promise<Response> {
	let form = await request.formData();
	return await match(subscribe(String(form.get("email"))), {
		success: () => new Response(null, { status: 204 }),
		failure: (error) =>
			error instanceof ValidationError
				? Response.json({ field: error.field, message: error.message }, { status: 422 })
				: Response.json({ message: error.message }, { status: 502 }),
	});
}
```

## Pattern: Retry only transient failures with a custom schedule

`when` keeps a permanent error from burning attempts, and a function `delay` takes a schedule with a ceiling and jitter, such as one from [`@sdxc/backoff`](https://www.npmjs.com/package/@sdxc/backoff).

```typescript
import type { Result } from "@sdxc/result";

import { createBackoff } from "@sdxc/backoff";
import { failure, isFailure, retry, RetryError, success } from "@sdxc/result";

class HttpError extends Error {
	constructor(readonly status: number) {
		super(`HTTP ${status}`);
	}
}

async function loadReport(url: string): Promise<Result<unknown, HttpError>> {
	let response = await fetch(url);
	if (!response.ok) return failure(new HttpError(response.status));
	return success(await response.json());
}

let backoff = createBackoff({ base: "1 second", max: "30 seconds", jitter: 0.2 });

let result = await retry(() => loadReport("https://api.example.com/report"), {
	times: 6,
	delay: (attempt) => backoff.delay(attempt),
	when: (error) => error.status >= 500,
});

if (isFailure(result) && result.error instanceof RetryError) {
	console.error(result.error.message); // "Failed after 1 attempts" for a 404
}
```

## Pattern: Process a batch and report what failed

Run every item through `wrap`, then `partition` the Results into the values to keep and the errors to report.

```typescript
import { partition, unwrap, wrap } from "@sdxc/result";

let urls = ["https://example.com/a.json", "https://example.com/b.json"];

let results = await Promise.all(
	urls.map((url) => wrap(() => fetch(url).then((response) => response.json()))),
);
let [documents, errors] = partition(results);

console.log(`${documents.length} loaded, ${errors.length} failed`);

let first = unwrap(results[0]!, () => null); // a single Result, with a fallback
```

## Pattern: Assert outcomes in tests

`succeeded` and `failed` narrow the Result, so the assertions that follow read `data` or `error` without a guard, and a wrong outcome fails with your message.

```typescript
import { failed, succeeded } from "@sdxc/result";
import { expect, test } from "vitest";

test("divides", () => {
	let result = divide(10, 2);
	succeeded(result, "Expected division to succeed");
	expect(result.data).toBe(5);
});

test("rejects division by zero", () => {
	let result = divide(1, 0);
	failed(result, "Expected division by zero to fail");
	expect(result.error.message).toBe("Division by zero");
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/result": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
