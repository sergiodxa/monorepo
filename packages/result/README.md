# @sdxc/result

Type-safe `Result` values that make success and failure explicit in your function signatures.

## Installation

```bash
npm add @sdxc/result
```

## Usage

### Return a Result

```typescript
import type { Result } from "@sdxc/result";

import { failure, isSuccess, success } from "@sdxc/result";

function divide(a: number, b: number): Result<number, Error> {
	if (b === 0) return failure(new Error("Division by zero"));
	return success(a / b);
}

let result = divide(10, 2);

if (isSuccess(result))
	console.log(result.data); // 5
else console.error(result.error.message);
```

### Handle both cases at once

```typescript
import { match } from "@sdxc/result";

let message = match(await fetchUser(id), {
	success: (user) => `Hello, ${user.name}!`,
	failure: (error) => `Error: ${error.message}`,
});
```

### Wrap code that throws

```typescript
import { wrap, isSuccess } from "@sdxc/result";

let result = wrap(() => JSON.parse(input));
if (isSuccess(result)) console.log(result.data);

let response = await wrap(() => fetch("/api/posts").then((r) => r.json()));
```

### Retry a failing operation

```typescript
import { retry } from "@sdxc/result";

let result = await retry(() => fetchUser(id), {
	times: 3,
	delay: 100,
	backoff: "exponential",
});
```

### Split a batch of Results

```typescript
import { partition, wrap } from "@sdxc/result";

let results = await Promise.all(urls.map((url) => wrap(() => fetch(url))));
let [responses, errors] = partition(results);
console.log(`${responses.length} succeeded, ${errors.length} failed`);
```

## API

### Types

#### `Result<T, E extends Error>`

A discriminated union of `Success<T>` and `Failure<E>`, narrowed by `isSuccess` and `isFailure`.

```typescript
type Result<T, E extends Error> = Success<T> | Failure<E>;
```

#### `Success<T>`

```typescript
interface Success<T> {
	status: "success";
	data: T;
}
```

#### `Failure<E extends Error>`

```typescript
interface Failure<E extends Error> {
	status: "failure";
	error: E;
}
```

### Functions

#### `success<T>(data: T): Success<T>`

Create a Success holding `data`.

```typescript
let user = success({ id: 1, name: "Alice" });
// same as
let user: Success<{ id: number; name: string }> = {
	status: "success",
	data: { id: 1, name: "Alice" },
};
```

The annotation is what the constructor buys you: it keeps `status` as the literal `"success"` that `Result` narrows on.

#### `failure<E extends Error>(error: E): Failure<E>`

Create a Failure holding `error`.

```typescript
let result = failure(new Error("Not found"));
// same as
let result: Failure<Error> = { status: "failure", error: new Error("Not found") };
```

The error type is preserved, so a custom `Error` subclass stays visible in the signature and in every handler:

```typescript
class NotFoundError extends Error {}

function fetchUser(id: string): Result<User, NotFoundError> {
	let user = db.find(id);
	if (!user) return failure(new NotFoundError(`User ${id} not found`));
	return success(user);
}
```

#### `isSuccess<T, E extends Error>(result: Result<T, E>): result is Success<T>`

Type guard that narrows a Result to `Success<T>`.

```typescript
isSuccess(result);
// same as
result.status === "success";
```

#### `isFailure<T, E extends Error>(result: Result<T, E>): result is Failure<E>`

Type guard that narrows a Result to `Failure<E>`.

```typescript
isFailure(result);
// same as
result.status === "failure";
```

#### `succeeded<T, E extends Error>(result: Result<T, E>, message?: string): asserts result is Success<T>`

Assert a Result is a Success, narrowing it for the rest of the scope. On a Failure it throws an `Error` with `message` (default `"Result is a failure"`) and the original error as `cause`.

```typescript
let result = await fetchUser(id);
succeeded(result, "Failed to load user data");
console.log(result.data.name);
```

#### `failed<T, E extends Error>(result: Result<T, E>, message?: string): asserts result is Failure<E>`

Assert a Result is a Failure, narrowing it for the rest of the scope. On a Success it throws an `Error` with `message` (default `"Result is a success"`) and the data as `cause`. Handy in tests.

```typescript
let result = validate({ email: "invalid" });
failed(result, "Expected validation to fail");
expect(result.error).toBeInstanceOf(ValidationError);
```

#### `unwrap<T, E extends Error>(result: Result<T, E> | Promise<Result<T, E>>, fallback?: (error: E) => T): T | Promise<T>`

Return the success data. With a `fallback`, a Failure produces the fallback value; without one, the error is thrown. A promise of a Result returns a promise of the value.

```typescript
unwrap(success(42)); // 42
unwrap(failure(new Error("not found")), () => 0); // 0
let user = await unwrap(fetchUser(id));
```

```typescript
let user = unwrap(await fetchUser(id));
// same as
let result = await fetchUser(id);
if (isFailure(result)) throw result.error;
let user = result.data;
```

#### `match<T, E extends Error, R>(result: Result<T, E> | Promise<Result<T, E>>, handlers: { success: (data: T) => R; failure: (error: E) => R }): R | Promise<R>`

Call `handlers.success` with the data or `handlers.failure` with the error, and return the handler's value. A promise of a Result returns a promise of that value.

```typescript
let status = match(result, {
	success: () => 200,
	failure: (error) => (error instanceof NotFoundError ? 404 : 500),
});
// same as
let status = isSuccess(result) ? 200 : result.error instanceof NotFoundError ? 404 : 500;
```

#### `wrap<T>(fn: () => T): Result<T, Error> | Promise<Result<T, Error>>`

Run `fn` and capture what it throws as a Failure. An async `fn` returns a promise of a Result. Thrown values that are not `Error` instances become `new Error(String(value))`.

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

#### `retry<T, E extends Error>(fn: () => Promise<Result<T, E>>, options: retry.Options<E>): Promise<Result<T, E | RetryError>>`

Call `fn` until it returns a Success, waiting between attempts. Once the attempts run out, or `when` declines an error, the returned Failure holds a `RetryError`.

- `times` — maximum number of attempts. Values of `0` or less throw a `RangeError`.
- `delay` — base delay between attempts, in milliseconds.
- `backoff` — `"constant"`, `"linear"`, or `"exponential"`. Defaults to `"exponential"`, which doubles the delay on every retry.
- `when` — predicate receiving the error and the attempt number; return `true` to keep retrying.

```typescript
let result = await retry(() => fetchUser(id), {
	times: 5,
	delay: 1000,
	when: (error) => error instanceof NetworkError,
});
```

#### `partition<T, E extends Error>(results: Result<T, E>[]): [T[], E[]]`

Split an array of Results into the success values and the failure errors, in one pass.

```typescript
let [values, errors] = partition([success(1), failure(new Error("a")), success(2)]);
// values = [1, 2], errors = [Error("a")]
```

### Classes

#### `RetryError`

The error `retry` puts in its Failure once the attempts are exhausted, with the message `Failed after <n> attempts`.

```typescript
let result = await retry(() => fetchUser(id), { times: 3, delay: 100 });
if (isFailure(result) && result.error instanceof RetryError) {
	console.log(result.error.message); // "Failed after 3 attempts"
}
```

## Pattern: Railway-oriented programming

Give every step the same `Result` shape, then chain them: each `isFailure` check
returns the failure untouched, so the happy path runs straight through.

```typescript
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

function parseUser(json: string): Result<unknown, Error> {
	return wrap(() => JSON.parse(json));
}

function validateUser(data: unknown): Result<User, Error> {
	if (!isValidUser(data)) return failure(new Error("Invalid user data"));
	return success(data as User);
}

function saveUser(user: User): Result<User, Error> {
	return success(db.save(user));
}

function processUserJson(json: string): Result<User, Error> {
	let parsed = parseUser(json);
	if (isFailure(parsed)) return parsed;

	let validated = validateUser(parsed.data);
	if (isFailure(validated)) return validated;

	return saveUser(validated.data);
}
```

## Pattern: Custom error types

Give each failure mode its own `Error` subclass and the union accumulates as the
steps compose, so a handler can tell the cases apart without parsing messages.

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

class NetworkError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

function validateEmail(email: string): Result<string, ValidationError> {
	if (!email.includes("@")) {
		return failure(new ValidationError("email", "Invalid email format"));
	}
	return success(email);
}

async function sendWelcome(email: string): Promise<Result<void, NetworkError>> {
	let response = await fetch("/api/welcome", { method: "POST", body: email });
	if (!response.ok) return failure(new NetworkError(response.status, "Send failed"));
	return success(undefined);
}

async function subscribe(email: string): Promise<Result<void, ValidationError | NetworkError>> {
	let validated = validateEmail(email);
	if (isFailure(validated)) return validated;
	return await sendWelcome(validated.data);
}

let status = match(await subscribe(input), {
	success: () => 204,
	failure: (error) => (error instanceof ValidationError ? 422 : 502),
});
```

## Pattern: Early returns

Handle each failure as soon as it appears and the happy path never indents.

```typescript
import { isFailure } from "@sdxc/result";

async function signup(request: Request): Promise<Response> {
	let validated = await validateForm(request);
	if (isFailure(validated)) {
		return Response.json({ error: validated.error.message }, { status: 400 });
	}

	let saved = await saveUser(validated.data);
	if (isFailure(saved)) {
		return Response.json({ error: saved.error.message }, { status: 500 });
	}

	return Response.json({ user: saved.data });
}
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
