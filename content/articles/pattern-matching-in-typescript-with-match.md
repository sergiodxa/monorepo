---
title: Pattern Matching in TypeScript with match()
excerpt: Replace verbose if/else chains with a functional match() helper that ensures exhaustive handling.
technologies: typescript@5.0.0
---

Pattern matching is a powerful concept from functional programming languages like Haskell, Rust, and OCaml. It allows you to declaratively handle different cases of a value in a single expression, rather than using imperative if/else chains or switch statements.

TypeScript doesn't have native pattern matching (yet), but we can implement a simple `match()` function that brings some of these benefits to our codebase.

## The Problem with Conditional Chains

Consider how we typically handle a [Result type](/articles/result-objects-in-ts) that can be either a success or a failure:

```ts
function handleResult(result: Result<User, Error>): string {
	if (isSuccess(result)) {
		return `Hello, ${result.data.name}!`;
	} else {
		return `Error: ${result.error.message}`;
	}
}
```

This works, but it has some drawbacks:

1. It's statement based, not expression based
2. The else branch is implicit, making it easy to forget
3. As cases grow, the code becomes harder to read

## A Simple match() Implementation

Here's a `match()` function that provides a more declarative approach:

```ts
import type { Result } from "./types.js";
import { isSuccess } from "./is-success.js";

export function match<T, E extends Error, R>(
	result: Result<T, E>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): R;
export function match<T, E extends Error, R>(
	result: Promise<Result<T, E>>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): Promise<R>;
export function match<T, E extends Error, R>(
	result: Result<T, E> | Promise<Result<T, E>>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): R | Promise<R> {
	if (result instanceof Promise) {
		return result.then((res) => match(res, handlers));
	}
	if (isSuccess(result)) return handlers.success(result.data);
	return handlers.failure(result.error);
}
```

The function uses TypeScript overloads to handle both synchronous and asynchronous Results. The implementation is straightforward: check if it's a Promise (and recursively call match), then dispatch to the appropriate handler based on the result's status.

## Expression Based Code

With `match()`, our code becomes expression based:

```ts
let message = match(result, {
	success: (user) => `Hello, ${user.name}!`,
	failure: (error) => `Error: ${error.message}`,
});
```

This is a single expression that returns a value. There's no need for intermediate variables or early returns. The intent is clear: we're transforming a Result into a message string.

## Exhaustive Handling

The handlers object requires both `success` and `failure` functions. TypeScript will error if you forget one:

```ts
// TypeScript Error: Property 'failure' is missing
let message = match(result, {
	success: (user) => `Hello, ${user.name}!`,
});
```

This is one of the key benefits of pattern matching: the compiler ensures you handle all cases. In a traditional if/else, forgetting the else branch might not cause a type error, leading to runtime bugs.

## Transforming Results

Pattern matching shines when transforming values. Here's an example of converting a Result to an HTTP status code:

```ts
let status = match(result, {
	success: () => 200,
	failure: (e) => (e instanceof NotFoundError ? 404 : 500), // Error classification determines the response
});
```

The return type is inferred from the handlers. Both handlers return numbers, so `status` is typed as `number`. If one returned a string, TypeScript would infer a union type.

## Working with Async Results

The overloaded signature handles Promises transparently:

```ts
let response = await match(fetchUser(id), {
	success: (user) => json(user),
	failure: (error) => json({ error: error.message }, { status: 404 }),
});
```

When you pass a `Promise<Result<T, E>>`, the function returns `Promise<R>`. The handlers still receive the unwrapped success or failure values, keeping the API consistent.

## Why Not Just Use if/else?

For simple cases, if/else is fine. But `match()` offers advantages as complexity grows:

**Readability**: All cases are visible in one place, formatted as a data structure rather than control flow.

**Composability**: Since it's an expression, you can use it directly in JSX, function arguments, or object literals.

**Type Safety**: The compiler enforces exhaustive handling, catching missing cases at build time.

**Consistency**: Every Result is handled the same way throughout your codebase.

## Extending the Pattern

This implementation is specific to Result types, but the pattern extends to any discriminated union. You might use similar techniques when [classifying errors for job retry behavior](/tutorials/classify-errors-for-job-retry-behavior) or handling validation outcomes:

```ts
type State =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "success"; data: User }
	| { status: "error"; error: Error };

function matchState<R>(
	state: State,
	handlers: {
		idle: () => R;
		loading: () => R;
		success: (data: User) => R;
		error: (error: Error) => R;
	},
): R {
	switch (state.status) {
		case "idle":
			return handlers.idle();
		case "loading":
			return handlers.loading();
		case "success":
			return handlers.success(state.data);
		case "error":
			return handlers.error(state.error);
	}
}
```

The switch statement with a discriminant property gives TypeScript the information it needs to narrow types in each case.

## Trade Offs

Pattern matching isn't always the right choice:

**Overhead**: For a simple success/failure check, an if statement is more direct.

**Learning Curve**: Developers unfamiliar with functional patterns might find it less intuitive initially.

**Bundle Size**: Adding a utility function adds (minimal) code to your bundle.

The sweet spot is when you have multiple places handling the same type of value, or when exhaustiveness checking provides real value in catching bugs.

## Conclusion

A simple `match()` function brings some benefits of pattern matching to TypeScript: expression based code, exhaustive handling, and cleaner transformations. It's not a replacement for native pattern matching (which may come to JavaScript eventually), but it's a practical tool that improves code quality today.

The implementation is small enough to copy into any project, and the pattern extends naturally to any discriminated union in your codebase. For validating inputs before matching, consider [building a universal validator with Standard Schema](/tutorials/build-a-universal-validator-with-standard-schema).
