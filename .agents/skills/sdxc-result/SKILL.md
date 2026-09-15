---
name: sdxc-result
description: "@sdxc/result is the `Result<T, E>` discriminated union other @sdxc packages return: `success` / `failure` constructors, the `isSuccess` / `isFailure` type guards, the `succeeded` / `failed` assertions, plus `unwrap`, `match`, `wrap`, `retry` and `partition`. Use when a function should report failure in its signature instead of throwing, when narrowing a `Result` a package handed back, when capturing a throwing call, or when retrying with backoff."
---

# @sdxc/result

A `Result<T, E extends Error>` is `Success<T> | Failure<E>`, discriminated on a `status` field of
`"success"` or `"failure"` and narrowed by the `isSuccess` / `isFailure` guards. The error type is
preserved, so a custom `Error` subclass stays visible in the signature and in every handler. Around
that sit the assertions `succeeded` / `failed`, the readers `unwrap` and `match`, `wrap` for code
that throws, `retry` with its `RetryError`, and `partition` for a batch. Plain TypeScript with no
runtime assumptions, so it works anywhere.

Full API, options and examples: [packages/result/README.md](packages/result/README.md)

## When to reach for it

- A failure is an expected outcome and the signature should say so rather than hiding it in a `throw`
- Another package answered with a `Result` and the value needs narrowing before the data is readable
- A throwing call — `JSON.parse`, a fetch, a third-party function — should become a value instead of a `try`/`catch`
- An operation is worth retrying with a delay, and only for certain errors
- A batch of results needs splitting into the values that worked and the errors that did not

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/result": "workspace:*" } }
```

```ts
import type { Result } from "@sdxc/result";

import { failure, isSuccess, success } from "@sdxc/result";

function divide(a: number, b: number): Result<number, Error> {
	if (b === 0) return failure(new Error("Division by zero"));
	return success(a / b);
}

let result = divide(10, 2);

if (isSuccess(result)) console.log(result.data);
else console.error(result.error.message);
```

## Suggestions

- Give each failure mode its own `Error` subclass. The union accumulates as steps compose, so a handler tells the cases apart with `instanceof` instead of parsing messages.
- Handle each failure with an early return: `if (isFailure(x)) return x;` passes the failure through untouched and keeps the happy path unindented.
- `unwrap` and `match` both accept a promise of a `Result` and return a promise of the value, so `await unwrap(fetchUser(id))` is the same as awaiting then checking.
- `wrap` turns a non-`Error` throw into `new Error(String(value))`, and an async `fn` gives back a promise of a `Result`.
- `retry` defaults to `"exponential"` backoff, rejects a `times` of `0` or less with a `RangeError`, and reports exhaustion as a `RetryError` — check for it with `instanceof` when the distinction matters.
- `failed(result, message)` is the assertion to use in tests: it narrows to `Failure<E>` for the rest of the scope so `result.error` is readable without a guard.
