# @pkg/result

Type-safe Result pattern for handling success and failure cases without exceptions.

## Overview

The Result pattern is a functional approach to error handling that makes success and failure explicit in your type system. Instead of throwing exceptions, functions return a `Result<T, E>` that can be either a `Success<T>` or a `Failure<E>`.

This pattern is also known as "railway-oriented programming" - your data flows through a series of transformations, where each step can succeed or fail, and failures short-circuit the pipeline.

## Usage

```typescript
import {
	success,
	failure,
	isSuccess,
	isFailure,
	unwrap,
	match,
	wrap,
	retry,
	partition,
	type Result,
} from "@pkg/result";

function divide(a: number, b: number): Result<number, Error> {
	if (b === 0) {
		return failure(new Error("Division by zero"));
	}
	return success(a / b);
}

let result = divide(10, 2);

if (isSuccess(result)) {
	console.log("Result:", result.data); // Result: 5
} else {
	console.error("Error:", result.error.message);
}
```

## API

### Types

#### `Result<T, E extends Error>`

A discriminated union type representing either success or failure.

```typescript
type Result<T, E extends Error> = Success<T> | Failure<E>;
```

#### `Success<T>`

Represents a successful result containing data.

```typescript
interface Success<T> {
	status: "success";
	data: T;
}
```

#### `Failure<E extends Error>`

Represents a failed result containing an error.

```typescript
interface Failure<E extends Error> {
	status: "failure";
	error: E;
}
```

### Functions

#### `success<T>(data: T): Success<T>`

Creates a successful result containing the provided data.

**Parameters:**

- `data`: The success value to wrap

**Returns:**

- A `Success<T>` object with `status: "success"` and the provided data

**Example:**

```typescript
let result = success({ id: 1, name: "Alice" });
// { status: "success", data: { id: 1, name: "Alice" } }
```

#### `failure<E extends Error>(error: E): Failure<E>`

Creates a failed result containing the provided error.

**Parameters:**

- `error`: The error to wrap (must extend Error)

**Returns:**

- A `Failure<E>` object with `status: "failure"` and the provided error

**Example:**

```typescript
let result = failure(new Error("Something went wrong"));
// { status: "failure", error: Error("Something went wrong") }
```

#### `isSuccess<T, E extends Error>(result: Result<T, E>): result is Success<T>`

Type guard that checks if a result is successful and narrows the type.

**Parameters:**

- `result`: The result to check

**Returns:**

- `true` if the result is a success, `false` otherwise

**Example:**

```typescript
let result: Result<number, Error> = divide(10, 2);

if (isSuccess(result)) {
	// TypeScript knows result is Success<number>
	console.log(result.data); // ✓ TypeScript knows data exists
}
```

#### `isFailure<T, E extends Error>(result: Result<T, E>): result is Failure<E>`

Type guard that checks if a result is a failure and narrows the type.

**Parameters:**

- `result`: The result to check

**Returns:**

- `true` if the result is a failure, `false` otherwise

**Example:**

```typescript
let result: Result<number, Error> = divide(10, 0);

if (isFailure(result)) {
	// TypeScript knows result is Failure<Error>
	console.error(result.error.message); // ✓ TypeScript knows error exists
}
```

#### `succeeded<T, E extends Error>(result: Result<T, E>, message?: string): asserts result is Success<T>`

Assertion function that throws if the result is a failure. Useful for unwrapping results when you're certain they should succeed.

**Parameters:**

- `result`: The result to assert
- `message`: Optional custom error message (defaults to "Result is a failure")

**Throws:**

- `Error` if the result is a failure, with the original error as the cause

**Example:**

```typescript
let result = divide(10, 2);
succeeded(result); // Doesn't throw
// After this line, TypeScript knows result is Success<number>
console.log(result.data); // 5

let badResult = divide(10, 0);
succeeded(badResult); // Throws: "Result is a failure"
```

#### `failed<T, E extends Error>(result: Result<T, E>, message?: string): asserts result is Failure<E>`

Assertion function that throws if the result is a success. Useful in tests or when you expect a failure.

**Parameters:**

- `result`: The result to assert
- `message`: Optional custom error message (defaults to "Result is a success")

**Throws:**

- `Error` if the result is a success, with the original data as the cause

**Example:**

```typescript
let result = divide(10, 0);
failed(result); // Doesn't throw
// After this line, TypeScript knows result is Failure<Error>
console.error(result.error.message); // "Division by zero"
```

#### `unwrap<T, E extends Error>(result: Result<T, E> | Promise<Result<T, E>>, fallback?: (error: E) => T): T | Promise<T>`

Extract the success value from a Result, or throw/compute a fallback on failure. Accepts both sync and async Results.

**Parameters:**

- `result`: The Result (or Promise of Result) to unwrap
- `fallback`: Optional function to compute a fallback value from the error

**Returns:**

- The success data, or the fallback value if provided and Result is a Failure

**Throws:**

- The error from the Failure if no fallback is provided

**Example:**

```typescript
let data = unwrap(success(42)); // 42
let data = unwrap(failure(new Error("oops"))); // throws Error("oops")

// With fallback
let count = unwrap(failure(new Error("not found")), () => 0); // 0

// With async Results
let user = await unwrap(fetchUser(id));
let user = await unwrap(fetchUser(id), () => defaultUser);
```

#### `match<T, E extends Error, R>(result: Result<T, E> | Promise<Result<T, E>>, handlers: { success: (data: T) => R; failure: (error: E) => R }): R | Promise<R>`

Pattern match on a Result, calling the appropriate handler based on its status. Accepts both sync and async Results.

**Parameters:**

- `result`: The Result (or Promise of Result) to match on
- `handlers`: Object with `success` and `failure` handler functions

**Returns:**

- The return value of the matched handler

**Example:**

```typescript
let message = match(result, {
	success: (user) => `Hello, ${user.name}!`,
	failure: (error) => `Error: ${error.message}`,
});

// Transform Result to HTTP status
let status = match(result, {
	success: () => 200,
	failure: (e) => (e instanceof NotFoundError ? 404 : 500),
});

// With async Results
let response = await match(fetchUser(id), {
	success: (user) => json(user),
	failure: (error) => json({ error: error.message }, { status: 404 }),
});
```

#### `wrap<T>(fn: () => T): Result<T, Error> | Promise<Result<T, Error>>`

Convert a throwing function into a Result-returning function. Catches exceptions and returns them as Failure instead of throwing. Handles both sync and async functions.

**Parameters:**

- `fn`: Function to wrap (can be sync or async)

**Returns:**

- Success with the value if fn succeeds, Failure with Error if fn throws

**Example:**

```typescript
// Sync function
let result = wrap(() => JSON.parse('{"valid": true}'));
if (isSuccess(result)) console.log(result.data); // { valid: true }

// Async function
let result = await wrap(() => fetch("/api/data").then((r) => r.json()));
if (isFailure(result)) console.error(result.error.message);
```

#### `retry<T, E extends Error>(fn: () => Promise<Result<T, E>>, options: retry.Options<E>): Promise<Result<T, E | RetryError>>`

Retry a Result-returning async function with configurable backoff. Retries until success, max attempts exceeded, or `when` predicate returns false.

**Parameters:**

- `fn`: Async function that returns a Result
- `options.times`: Maximum number of retry attempts
- `options.delay`: Base delay between retries (number in ms or string like "100ms", "1s")
- `options.backoff`: Backoff strategy: "constant", "linear", or "exponential" (default)
- `options.when`: Optional predicate to decide if error should be retried

**Returns:**

- The successful Result, or a Failure with RetryError after all attempts exhausted

**Example:**

```typescript
let result = await retry(() => fetchData(url), { times: 3, delay: "100ms" });

// Only retry on network errors with exponential backoff
let result = await retry(() => fetchData(url), {
	times: 5,
	delay: "1s",
	backoff: "exponential",
	when: (error) => error instanceof NetworkError,
});
```

#### `partition<T, E extends Error>(results: Result<T, E>[]): [T[], E[]]`

Split an array of Results into separate success values and failure errors. Processes the array in a single pass for efficiency.

**Parameters:**

- `results`: Array of Result objects to partition

**Returns:**

- Tuple of `[successValues, failureErrors]`

**Example:**

```typescript
let results = [success(1), failure(new Error("a")), success(2)];
let [values, errors] = partition(results);
// values = [1, 2]
// errors = [Error("a")]

// Process multiple async operations and separate successes from failures
let results = await Promise.all(urls.map((url) => wrap(() => fetch(url))));
let [responses, errors] = partition(results);
console.log(`${responses.length} succeeded, ${errors.length} failed`);
```

### Classes

#### `RetryError`

Error thrown when all retry attempts have been exhausted.

**Example:**

```typescript
let result = await retry(() => fetchData(), { times: 3, delay: "100ms" });
if (isFailure(result) && result.error instanceof RetryError) {
	console.log(result.error.message); // "Failed after 3 attempts"
}
```

## Type Safety

The Result pattern provides excellent type safety through discriminated unions:

```typescript
function processResult(result: Result<number, Error>): string {
	// TypeScript enforces handling both cases
	if (isSuccess(result)) {
		return `Success: ${result.data}`;
	}
	return `Error: ${result.error.message}`;
}
```

## Pattern: Railway-Oriented Programming

Chain operations where each step can fail:

```typescript
function parseUser(json: string): Result<unknown, Error> {
	try {
		return success(JSON.parse(json));
	} catch (error) {
		return failure(new Error("Invalid JSON"));
	}
}

function validateUser(data: unknown): Result<User, Error> {
	if (!isValidUser(data)) {
		return failure(new Error("Invalid user data"));
	}
	return success(data as User);
}

function saveUser(user: User): Result<User, Error> {
	// ... database operation
	return success(user);
}

function processUserJson(json: string): Result<User, Error> {
	let parseResult = parseUser(json);
	if (isFailure(parseResult)) return parseResult;

	let validateResult = validateUser(parseResult.data);
	if (isFailure(validateResult)) return validateResult;

	return saveUser(validateResult.data);
}
```

## Pattern: Custom Error Types

Use custom error classes for detailed error handling:

```typescript
class ValidationError extends Error {
	constructor(
		public field: string,
		message: string,
	) {
		super(message);
	}
}

class NetworkError extends Error {
	constructor(
		public statusCode: number,
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

function sendEmail(email: string): Result<void, NetworkError> {
	// ... API call
	return success(undefined);
}
```

## Pattern: Early Returns

Use early returns to handle failures and keep the happy path unindented:

```typescript
export async function action({ request }: Route.ActionArgs) {
	let result = await validateForm(request);
	if (isFailure(result)) {
		return badRequest({ errors: result.error.issues });
	}

	let saveResult = await saveData(result.data);
	if (isFailure(saveResult)) {
		return internalServerError({ error: saveResult.error.message });
	}

	return ok({ data: saveResult.data });
}
```

## Comparison with Try/Catch

**Traditional try/catch:**

```typescript
function divide(a: number, b: number): number {
	if (b === 0) throw new Error("Division by zero");
	return a / b;
}

try {
	let result = divide(10, 0);
	console.log(result);
} catch (error) {
	console.error(error);
}
```

**With Result pattern:**

```typescript
function divide(a: number, b: number): Result<number, Error> {
	if (b === 0) return failure(new Error("Division by zero"));
	return success(a / b);
}

let result = divide(10, 0);
if (isFailure(result)) {
	console.error(result.error);
} else {
	console.log(result.data);
}
```

**Advantages of Result:**

1. **Explicit in types** - Function signatures show that failure is possible
2. **No hidden control flow** - No invisible exception unwinding
3. **Type-safe** - TypeScript enforces handling both cases
4. **Composable** - Easy to chain operations and short-circuit on failure
5. **Testable** - No need to wrap tests in try/catch

**When to use try/catch:**

- Truly exceptional conditions (out of memory, stack overflow)
- When working with libraries that throw
- When the calling code can't reasonably handle the error

**When to use Result:**

- Validation errors
- Business logic errors
- Expected failure cases
- When you want explicit error handling in types
- When composing multiple operations that can fail

## Integration with React Router

Use with `@pkg/response` for type-safe actions:

```typescript
import { success, failure, isFailure } from "@pkg/result";
import { ok, badRequest } from "@pkg/response";

export async function action({ request }: Route.ActionArgs) {
	let validation = await validateForm(request);

	if (isFailure(validation)) {
		return badRequest({ errors: validation.error.issues });
	}

	await saveData(validation.data);
	return ok({ message: "Success!" });
}
```

## Tips

1. **Use type guards** - Prefer `isSuccess()` and `isFailure()` over checking `status` directly
2. **Early returns** - Return failures early to keep the happy path unindented
3. **Custom errors** - Create specific error classes for different failure modes
4. **Assertion helpers** - Use `succeeded()` and `failed()` in tests or when you're certain of the outcome
5. **Don't mix patterns** - In a codebase using Result, avoid throwing exceptions for expected errors
