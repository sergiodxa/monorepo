---
title: Why Value Objects Make OAuth Tokens Easier to Work With
excerpt: Why wrapping OAuth tokens as value objects can clarify rules, reduce mixups, and surface trade offs.
---

OAuth tokens often enter a TypeScript codebase as strings or loose objects. That works at first, until access tokens, refresh tokens, and ID tokens start flowing through the same functions with different rules. A token that expires, carries scopes, or identifies a user is rarely just a string.

This is where value objects become useful. They let you move token specific rules into a type with clear boundaries. That can make OAuth code easier to reason about, but it also adds structure that not every codebase needs.

## The Problem With Token Strings

When a function accepts `string`, TypeScript cannot tell whether that string is an access token, a refresh token, or an ID token. It also cannot tell whether the value has already been decoded, whether required claims are present, or whether expiration has been checked.

```ts
function validateRequest(token: string) {
	let payload = decodeJWT(token);
	return payload.sub;
}
```

The problem is not that this code fails immediately. The problem is that the important rules live outside the type system. Every caller has to remember what kind of token it holds and what validations still need to happen.

That gets harder once you are dealing with [access tokens, refresh tokens, and ID tokens](/articles/oauth2-tokens-explained). They may all arrive in similar shapes, but they do not mean the same thing and should not be used interchangeably.

## What a Value Object Changes

A value object wraps the token data and exposes the parts of the token in domain terms. Instead of reaching into `payload.sub` or `payload.scope`, you read properties that describe intent.

```ts
class AccessToken extends JWT {
	get subject(): string {
		return this.parser.string("sub");
	}

	get scope(): string {
		return this.parser.string("scope");
	}

	isExpired(now = Date.now() / 1000): boolean {
		return this.parser.number("exp") <= now;
	}
}
```

This does not make the token safer by itself. It changes where safety lives. Validation, parsing, and naming move closer to the data, so the rest of the code can depend on a smaller surface area.

That provides a few concrete benefits. The code becomes easier to read, repeated claim parsing moves to one place, and the compiler can distinguish richer token types. Those are practical gains, not theoretical ones.

## Why Token Types Matter

OAuth implementations usually handle more than one token type. Even if two tokens are both JWTs, they may have different claims, different lifetimes, and different allowed uses.

With plain strings, confusing those tokens is easy. With value objects, the distinction can become part of the API.

```ts
function introspect(token: AccessToken) {
	return token.subject;
}

let refreshToken = RefreshToken.generate(/* ... */);

introspect(refreshToken);
```

In this example, the mistake is visible at compile time instead of surfacing later as an authorization bug. That is often the strongest argument for the pattern in TypeScript. It reduces accidental misuse between values that look similar but carry different rules.

## The Alternatives

Value objects are not the only way to improve token handling. If the main issue is validation, a schema at the boundary plus a plain object may be enough. If the main issue is token confusion, branded string types can separate `AccessTokenString` from `RefreshTokenString` with much less code.

You can also stay with decoded payload objects and use helper functions such as `getSubject(payload)` or `isExpired(payload)`. That keeps the model simple and avoids introducing classes. The trade off is that behavior remains distributed across functions instead of traveling with the value itself.

Another important distinction is opaque tokens versus self contained tokens. A value object fits naturally when you decode claims locally. If your access token is opaque and all meaning comes from introspection, a wrapper may still help, but the object becomes more about request results than token structure.

## When the Pattern Pays Off

The pattern usually pays off when token rules keep spreading. Repeated expiration checks, scope parsing, audience normalization, and claim name lookups are signs that the token already behaves like a richer concept.

It also helps when the cost of mixing values is high. Confusing an ID token with an access token, or a refresh token with a session identifier, is the kind of mistake that benefits from stronger modeling.

In smaller applications, the payoff may be limited. If one route decodes one token shape in one place, a small validation function may be clearer than introducing a class hierarchy.

## The Trade Offs

Value objects provide stronger boundaries, but at the cost of more code. You need constructors or factories, serialization rules, and tests for the object itself. That overhead is reasonable in a security sensitive authentication layer, but it can feel heavy in a small application.

They also introduce abstraction. Teams that are comfortable with plain data may find a token wrapper harder to follow, especially if the object hides too much behavior behind accessors. A model that feels explicit to one team can feel indirect to another.

There is a design choice around strictness too. Validating everything at construction time gives strong guarantees, but it can make partial or untrusted data harder to represent. Delayed validation is more flexible, but then the object cannot promise as much.

## Conclusion

Value objects are a good fit for OAuth tokens when token specific rules are becoming part of the domain, not just transport details. They can make token types distinct, centralize claim handling, and reduce the number of places where OAuth knowledge leaks into the codebase.

They are not the default best choice for every application. If token handling is simple, a schema and a few focused helpers may be enough. If the rules are growing and misuse is becoming expensive, a value object is a reasonable way to make those constraints explicit.
