---
title: Why Value Objects Make OAuth Tokens Easier to Work With
excerpt: Understanding the value object pattern and how it brings type safety and encapsulation to token handling.
---

OAuth tokens look like strings, but they carry meaning. An access token encodes authorization decisions. A refresh token represents a persistent grant. An ID token contains identity claims. When you treat these as plain strings, you end up scattering validation, parsing, and expiration logic across your codebase. The value object pattern offers a better approach.

## What Is a Value Object?

A value object is an object defined by its data rather than its identity. Two value objects with the same data are considered equal, regardless of whether they are the same instance. This contrasts with entities, where identity matters: two users with the same name are still different users if they have different IDs.

The classic examples are straightforward: a `Money` object holds an amount and currency, a `DateRange` holds start and end dates, an `Email` holds a validated email string. These objects encapsulate validation rules and behavior that would otherwise be scattered throughout your code.

For OAuth tokens, the pattern works well because tokens are inherently value objects. An access token is defined entirely by its claims. Two tokens with identical payloads are functionally the same, and there is no separate "identity" to track.

## The Problem with Primitive Obsession

When you pass tokens around as strings, you lose all the context about what that string represents. Consider a function that accepts a token:

```ts
function validateRequest(token: string) {
	let decoded = decodeJWT(token);
	if (decoded.exp < Date.now() / 1000) {
		throw new Error("Token expired");
	}
	// ...
}
```

This code has subtle issues. The `exp` claim is compared manually, and it is easy to forget this check elsewhere. Claim names like `sub` or `aud` are just strings, so typos go unnoticed. The caller might pass any string, including a refresh token where an access token was expected.

This is what Domain Driven Design calls "primitive obsession," using basic types like strings and numbers where a richer type would be more appropriate. The primitive type provides no constraints, no behavior, and no documentation about what values are valid.

## What Value Objects Provide

A value object wraps the token payload and exposes typed accessors for each claim. Instead of accessing `payload.sub`, you call `token.subject`. Instead of manually checking expiration, the object handles it during construction or provides a method for it.

```ts
class AccessToken extends JWT {
	get subject() {
		return this.parser.string("sub");
	}

	get scope() {
		return this.parser.string("scope");
	}
}
```

This design offers several benefits:

**Type safety.** Each accessor has a defined return type. The `subject` property returns a string. The `expiresAt` property returns a number or a Date. The compiler catches mistakes that would otherwise surface at runtime.

**Validation at the boundary.** The parser methods throw if a required claim is missing or has the wrong type. You validate once when creating the object, then trust the data throughout its lifetime.

**Self documenting code.** When you read `token.subject` instead of `payload.sub`, the code explains itself. New team members understand what a token contains without consulting the JWT or OAuth specifications.

**Encapsulated behavior.** Scope parsing, audience normalization, and other transformations live in one place. You change them once, and every usage benefits.

## Factory Methods Encode Business Rules

Value objects often include factory methods that know how to construct valid instances. For tokens, this means encoding TTL durations, required claims, and serialization formats:

```ts
static generate(issuer: string, audience: string, subjectId: string) {
  let now = Math.floor(Date.now() / 1000);
  return new AccessToken({
    iss: issuer,
    aud: audience,
    sub: subjectId,
    exp: now + 3600,
    iat: now,
    jti: crypto.randomUUID(),
  });
}
```

The factory encodes that access tokens live for one hour, that they need a unique identifier, and that timestamps use seconds rather than milliseconds. Callers provide business data; the factory handles the mechanics.

## Distinguishing Token Types

One underappreciated benefit of value objects is that they make different token types distinct at the type level. An `AccessToken` and a `RefreshToken` might both be JWTs, but they serve different purposes and have different claims.

When both are strings, nothing prevents you from passing a refresh token to a function expecting an access token. With value objects, the type system catches the mistake:

```ts
function introspect(token: AccessToken) {
	// This function only accepts access tokens
}

let refreshToken = RefreshToken.generate(/* ... */);
introspect(refreshToken); // Type error
```

This distinction becomes especially valuable in OAuth implementations where you handle multiple token types: access tokens, refresh tokens, ID tokens, authorization codes, and logout tokens. Each has its own structure and validation rules.

## When to Use Value Objects

Value objects work well whenever a primitive type starts accumulating behavior or constraints. Some indicators:

**Validation logic repeats.** If you find yourself checking the same conditions in multiple places, a value object can centralize that validation.

**Parsing or transformation is needed.** OAuth scopes are stored as space separated strings but used as sets or arrays. A `ScopeSet` object can handle the conversion once.

**The primitive can be confused with other primitives.** User IDs, client IDs, and session IDs are all strings. Wrapping each in a distinct type prevents mixups.

**Behavior accompanies the data.** Tokens need expiration checks, signature verification, and claim extraction. A class can provide methods for these operations.

The pattern applies beyond tokens. Email addresses, URLs, monetary amounts, date ranges, and coordinates all benefit from the same treatment.

## Trade Offs to Consider

Value objects add code. For a simple application that only handles one token type, a plain object might be sufficient. The pattern pays off as complexity grows, but it introduces overhead that may not be justified in every context.

There is also a learning curve. Developers unfamiliar with the pattern may find the abstraction confusing at first. The benefit of "token.subject instead of payload.sub" only materializes if everyone on the team understands why the wrapper exists.

Serialization requires attention. Value objects often need methods to convert to and from formats suitable for storage or transmission. A token might need a `toJSON()` method or a `sign()` method that produces a JWT string.

Finally, immutability should be maintained. Value objects work best when their data cannot change after construction. In JavaScript and TypeScript, this requires discipline or the use of techniques like private fields and getter only properties.

## Composing Value Objects

Value objects compose well. A `ScopeSet` encapsulates scope handling: parsing from strings, validating against allowed scopes, computing intersections. An `AccessToken` can use `ScopeSet` internally:

```ts
class AccessToken extends JWT {
	get scopes() {
		return ScopeSet.fromString(this.parser.string("scope"));
	}
}
```

Now consumers work with a rich object rather than parsing strings themselves. The composition keeps each class focused on a single responsibility.

## Testing Value Objects

Because value objects are pure data with no external dependencies, they are straightforward to test. You construct an instance, call methods, and verify the results:

```ts
test("parses subject from payload", () => {
	let token = new AccessToken({ sub: "user-123" /* ... */ });
	expect(token.subject).toBe("user-123");
});
```

No mocks, no stubs, no test databases. The tests run quickly and document the expected behavior of each accessor and factory method.

## Conclusion

Value objects are not a new pattern, but they remain underused in TypeScript applications. For OAuth tokens, they provide a natural fit: encapsulating claim access, centralizing validation, and making token types distinct at the compiler level.

The upfront cost is a few small classes with typed accessors and factory methods. The return is code that is harder to misuse, easier to test, and clearer to read. When a string stops being "just a string" and starts carrying rules and behavior, consider wrapping it in a value object.
