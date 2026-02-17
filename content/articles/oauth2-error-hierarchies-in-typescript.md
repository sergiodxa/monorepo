---
title: OAuth2 Error Hierarchies in TypeScript
excerpt: Model OAuth2 protocol errors as a class hierarchy for type safety and spec compliance.
technologies: typescript@5.0.0
---

The OAuth2 specification (RFC 6749) defines a precise set of error codes that authorization servers must return. These aren't suggestions: clients depend on these exact strings to handle failures correctly. When you're building an authorization server—perhaps one that issues [JWT or opaque tokens](/articles/jwt-vs-opaque-tokens)—you need a way to ensure your error responses match the spec exactly while keeping your code maintainable.

A class hierarchy solves this problem elegantly. By modeling each OAuth2 error as its own class, you get compile time guarantees that your error codes are correct, descriptive error messages that help with debugging, and a clean pattern for catching and handling errors in your routes.

## The OAuth2 Error Specification

RFC 6749 Section 5.2 defines the error codes that token endpoints must return:

- `invalid_request`: The request is missing a required parameter or is otherwise malformed
- `invalid_client`: Client authentication failed
- `invalid_grant`: The authorization code or refresh token is invalid or expired
- `unauthorized_client`: The client is not authorized to use this grant type
- `unsupported_grant_type`: The grant type is not supported by the server
- `invalid_scope`: The requested scope is invalid or exceeds what was granted

The authorization endpoint (Section 4.1.2.1) adds a few more:

- `access_denied`: The resource owner denied the request
- `unsupported_response_type`: The response type is not supported
- `server_error`: An unexpected condition prevented the request from being fulfilled

Each error response must include an `error` field with the exact code and may include an `error_description` with human readable details.

## The Base Error Class

Start with a base class that extends the native `Error` and captures the two required pieces: the protocol error code and a description.

```ts
export class OAuth2Error extends globalThis.Error {
	override readonly name: string = "OAuth2Error";

	constructor(
		readonly code: string,
		readonly description: string,
	) {
		super(`OAuth2 error: ${code}`);
	}
}
```

The `code` property holds the exact string from the spec. The `description` provides context for debugging. By extending `Error`, you get stack traces and can use standard error handling patterns.

## Specialized Error Classes

Each OAuth2 error code becomes its own class. This is where the hierarchy pays off: each class hardcodes its error code, so you can never accidentally use the wrong one.

```ts
export class InvalidRequestError extends OAuth2Error {
	override readonly name = "InvalidRequestError";

	constructor(override readonly description: string) {
		super("invalid_request", description);
	}
}
```

The `invalid_request` code is baked into the class. When you throw an `InvalidRequestError`, you only need to provide the description. The error code is always correct.

Here's the same pattern for client authentication failures:

```ts
export class InvalidClientError extends OAuth2Error {
	override readonly name = "InvalidClientError";

	constructor(override readonly description: string) {
		super("invalid_client", description);
	}
}
```

And for grant validation failures:

```ts
export class InvalidGrantError extends OAuth2Error {
	override readonly name = "InvalidGrantError";

	constructor(override readonly description: string) {
		super("invalid_grant", description);
	}
}
```

Some errors have sensible defaults. An unauthorized client error usually means the same thing:

```ts
export class UnauthorizedClientError extends OAuth2Error {
	override readonly name = "UnauthorizedClientError";

	constructor(override readonly description: string = "Unauthorized client") {
		super("unauthorized_client", description);
	}
}
```

The default description means you can throw `new UnauthorizedClientError()` without any arguments when the standard message is sufficient.

## The Complete Error Set

Following this pattern, you end up with a complete set of error classes:

```ts
export class UnsupportedGrantTypeError extends OAuth2Error {
	override readonly name = "UnsupportedGrantTypeError";

	constructor(override readonly description: string) {
		super("unsupported_grant_type", description);
	}
}

export class InvalidScopeError extends OAuth2Error {
	override readonly name = "InvalidScopeError";

	constructor(override readonly description: string) {
		super("invalid_scope", description);
	}
}

export class AccessDeniedError extends OAuth2Error {
	override readonly name = "AccessDeniedError";

	constructor(override readonly description: string) {
		super("access_denied", description);
	}
}

export class UnsupportedResponseTypeError extends OAuth2Error {
	override readonly name = "UnsupportedResponseTypeError";

	constructor(override readonly description: string) {
		super("unsupported_response_type", description);
	}
}
```

Each class is minimal: just enough to enforce the correct error code while allowing custom descriptions.

## Using the Error Hierarchy

In your service layer, throw the appropriate error when validation fails:

```ts
async function exchangeAuthorizationCode(code: string, redirectUri: string) {
	let authz = await db.findAuthorizationCode(code);
	if (!authz) {
		throw new InvalidGrantError("Code has expired or is invalid");
	}

	let client = await db.findClient(authz.clientId);
	if (!client) {
		throw new InvalidClientError("Client not found");
	}

	if (authz.redirectUri !== redirectUri) {
		throw new InvalidGrantError("Redirect URI mismatch");
	}

	// Continue with token generation...
}
```

Each throw statement is self documenting. You can see exactly what OAuth2 error will be returned without checking the class definition.

## Handling Errors in Routes

In your route handler, catch the base class and format the response:

```ts
export async function action({ request }: ActionArgs) {
	try {
		let tokens = await exchangeAuthorizationCode(code, redirectUri);
		return Response.json(tokens, { status: 200 });
	} catch (error) {
		if (error instanceof OAuth2Error) {
			return Response.json(
				{ error: error.code, error_description: error.description },
				{ status: 400 },
			);
		}

		return Response.json(
			{ error: "server_error", error_description: "An unexpected error occurred" },
			{ status: 500 },
		);
	}
}
```

The `instanceof OAuth2Error` check catches all protocol errors. The response format matches the spec exactly: an `error` field with the code and an `error_description` field with the details.

## Benefits of Typed Errors

This pattern provides several advantages over using plain objects or string error codes.

**Compile time safety**: You can't misspell an error code because it's defined once in the class. If you try to use `"invald_request"` instead of `"invalid_request"`, you'll get a type error.

**Exhaustive handling**: TypeScript can verify you've handled all error types when you use discriminated unions or switch statements on the error name.

**Stack traces**: Because these extend `Error`, you get full stack traces for debugging. You can see exactly where the error was thrown.

**Consistent formatting**: The base class ensures all errors have the same structure. You can't forget to include the code or description.

**Self documenting code**: When you see `throw new InvalidGrantError("PKCE validation failed")`, you know exactly what OAuth2 error the client will receive. For more on PKCE, see [how to use PKCE in the OAuth2 authorization code flow](/tutorials/use-pkce-in-oauth2-authorization-code-flow).

## Extending for Custom Errors

Sometimes you need errors that aren't in the OAuth2 spec. You can extend the hierarchy for these:

```ts
export class MissingValidationError extends OAuth2Error {
	override readonly name = "MissingValidationError";

	constructor(override readonly description: string = "Verification required") {
		super("missing_validation", description);
	}
}
```

This maintains the same pattern while adding application specific errors. Clients that understand your custom codes can handle them, while others will treat them as generic errors.

## Error Hierarchies vs. Result Types

Some codebases prefer [result types](/articles/result-objects-in-ts) over exceptions. You can combine both approaches: use the error classes to define the error shapes, then wrap them in a result type for functions that commonly fail.

The error hierarchy still provides value because it enforces the correct error codes and provides a consistent structure, regardless of whether you throw the errors or return them.

## Final Thoughts

OAuth2 error handling is a place where protocol compliance matters. Clients parse these error codes programmatically, so returning the wrong code breaks integrations. This same principle of [classifying errors by type](/articles/error-classification-in-background-job-systems) applies broadly—whether you're building auth flows or background job systems. A class hierarchy makes it impossible to use the wrong code while keeping your error handling code clean and type safe.

The pattern scales well: as you implement more OAuth2 extensions (like PKCE or token introspection), you add new error classes following the same structure. Each class is small, focused, and correct by construction.
