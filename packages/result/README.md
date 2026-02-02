# @pkg/result

Type-safe Result pattern for handling success and failure cases without exceptions.

## Overview

The Result pattern is a functional approach to error handling that makes success and failure explicit in your type system. Instead of throwing exceptions, functions return a `Result<T, E>` that can be either a `Success<T>` or a `Failure<E>`.

This pattern is also known as "railway-oriented programming" - your data flows through a series of transformations, where each step can succeed or fail, and failures short-circuit the pipeline.

## Usage

```typescript
import { success, failure, isSuccess, isFailure, type Result } from "@pkg/result";

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
