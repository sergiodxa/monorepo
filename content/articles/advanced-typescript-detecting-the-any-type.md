---
title: "Advanced TypeScript: Detecting the any Type"
excerpt: Learn how to detect the any type in TypeScript using a clever conditional type trick.
technologies: typescript@5.0.0
---

TypeScript's `any` type is a peculiar beast. It simultaneously represents every possible type and no type at all. This duality makes it both useful as an escape hatch and dangerous when it silently propagates through your codebase. But what if you could detect when a type is `any` and handle it differently?

## The Problem with `any`

The `any` type has a unique property: it absorbs everything. When you intersect `any` with another type, the result is `any`. When you union `any` with another type, the result is still `any`. This absorption behavior is what makes `any` so problematic, but it's also what allows us to detect it.

Consider a utility type that should behave differently when given `any` versus a concrete type. For example, you might want to:

- Provide a fallback type when the input is `any`
- Show a compile-time error when `any` leaks into a type-safe API
- Conditionally transform types based on whether they're `any`

Without the ability to detect `any`, these scenarios become impossible to handle at the type level.

## The Detection Trick

Here's the type that detects `any`:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;
```

This single line leverages TypeScript's type system in a subtle way. Let's break down why it works.

## Understanding the Mechanism

The expression `1 & T` creates an intersection type between the literal type `1` and whatever `T` is. Then we check if `0` extends that intersection.

For most types, this check fails:

```ts
type A = IsAny<string>; // false
type B = IsAny<number>; // false
type C = IsAny<unknown>; // false
type D = IsAny<never>; // false
type E = IsAny<null>; // false
```

Why? Because `1 & string` results in `never` (no value can be both `1` and a string simultaneously), and `0` does not extend `never`. The same logic applies to other concrete types.

But with `any`, something different happens:

```ts
type F = IsAny<any>; // true
```

When `T` is `any`, the intersection `1 & any` evaluates to `any` (because `any` absorbs everything). And here's the key insight: `any` is both a supertype and a subtype of every type. This means `0 extends any` is `true`.

## Why Other Types Don't Trigger a False Positive

You might wonder about `unknown`, TypeScript's other "top type." The difference is that `unknown` doesn't absorb intersections the way `any` does:

```ts
type Test1 = 1 & unknown; // 1
type Test2 = 1 & any; // any
```

With `unknown`, the intersection `1 & unknown` simplifies to `1`, and `0 extends 1` is `false`. This is why `IsAny<unknown>` correctly returns `false`.

The `never` type is also interesting. Since `never` represents the empty set of values, `1 & never` is `never`, and `0 extends never` is `false`.

## Practical Applications

Detecting `any` enables several useful patterns in type-safe utilities.

### Providing Fallback Types

You can create a type that substitutes a fallback when the input is `any`:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;

type SafeType<T, Fallback> = IsAny<T> extends true ? Fallback : T;

type A = SafeType<string, unknown>; // string
type B = SafeType<any, unknown>; // unknown
```

This is useful when wrapping functions like `JSON.parse` that return `any`, allowing you to enforce a specific type or `unknown` at the type level. You might combine this with [building a universal validator](/tutorials/build-a-universal-validator-with-standard-schema) to ensure runtime safety matches your type-level guarantees.

### Conditional Type Logic

In more complex utility types, you might want to branch based on whether a type parameter is `any`:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;

type ProcessType<T> = IsAny<T> extends true ? { error: "Type cannot be any" } : { value: T };

type A = ProcessType<string>; // { value: string }
type B = ProcessType<any>; // { error: "Type cannot be any" }
```

### Enforcing Type Safety in Generic Functions

When building type-safe APIs, you can use `IsAny` to ensure that `any` doesn't silently propagate:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;

type NoAny<T> = IsAny<T> extends true ? never : T;

function processData<T>(data: NoAny<T>): T {
	return data;
}

const a = processData("hello"); // Works: string
const b = processData(123); // Works: number

const anyValue: any = "test";
const c = processData(anyValue); // Error: Argument of type 'any' is not assignable to parameter of type 'never'
```

## The Deeper Insight

What makes this trick work is the fundamental nature of `any` in TypeScript's type system. Unlike `unknown` (which is a proper top type that only accepts assignments from any type) or `never` (which is a proper bottom type that extends every type), `any` breaks the normal rules of type theory.

The `any` type is both a top type and a bottom type simultaneously. It accepts assignments from any type and can be assigned to any type. This bidirectional compatibility is what makes `any` dangerous, but it's also what makes it detectable.

The expression `0 extends 1 & T` exploits this: only when `T` is `any` does the intersection `1 & T` remain flexible enough for `0` to extend it.

## Conclusion

The `IsAny` type demonstrates how TypeScript's type system can be used to detect edge cases that seem impossible to distinguish at first glance. By understanding the unique absorption behavior of `any`, we can build more robust utility types that handle this special case explicitly.

Whether you're building a type-safe validation library, [creating type-safe wrapper classes](/tutorials/create-type-safe-jwt-wrapper-classes), or just want to prevent `any` from leaking through your codebase, this detection technique gives you the tools to handle `any` intentionally rather than accidentally.
