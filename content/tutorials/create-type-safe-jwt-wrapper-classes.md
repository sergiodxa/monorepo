---
title: How to Create Type-Safe JWT Wrapper Classes
excerpt: Encapsulate JWT structure with typed property accessors for safer token handling.
tech: jose@5.0.0
---

When working with [JWTs](/articles/jwt-vs-opaque-tokens) in authentication systems, you often need to access specific claims like the subject, audience, or custom fields like email and username. Raw JWT payloads are untyped objects where any property access is a potential runtime error. You might access `payload.sub` expecting a string but get `undefined`, or try to read `payload.email_verified` as a boolean when it's actually missing.

The challenge is making JWT access both type safe and convenient. You want TypeScript to know exactly what claims exist on each token type, and you want runtime validation to catch malformed tokens before they cause errors deeper in your code. Wrapper classes solve this by encapsulating the JWT structure and exposing typed property accessors.

## Create an Access Token Class

Start with a class that wraps the JWT payload and provides typed accessors for standard claims:

```ts {% path="app/entities/access-token.ts" %}
import * as jose from "jose";

import { ACCESS_TOKEN_TTL, ISSUER } from "../config";

interface AccessTokenPayload extends jose.JWTPayload {
	jti: string;
	aud: string;
	exp: number;
	iat: number;
	iss: string;
	sub: string;
}

export default class AccessToken {
	constructor(private payload: AccessTokenPayload) {}

	get id(): string {
		return this.assertString(this.payload.jti, "jti");
	}

	get audience(): string {
		return this.assertString(this.payload.aud, "aud");
	}

	get expiresIn(): number {
		return this.assertNumber(this.payload.exp, "exp");
	}

	get issuedAt(): Date {
		return new Date(this.assertNumber(this.payload.iat, "iat") * 1000);
	}

	get issuer(): string {
		return this.assertString(this.payload.iss, "iss");
	}

	get subject(): string {
		return this.assertString(this.payload.sub, "sub");
	}

	toPayload(): AccessTokenPayload {
		return this.payload;
	}

	private assertString(value: unknown, claim: string): string {
		if (typeof value !== "string") {
			throw new Error(`Expected ${claim} to be a string`);
		}
		return value;
	}

	private assertNumber(value: unknown, claim: string): number {
		if (typeof value !== "number") {
			throw new Error(`Expected ${claim} to be a number`);
		}
		return value;
	}

	static generate(audience: string | string[], subjectId: string) {
		let now = Math.floor(Date.now() / 1000);
		return new AccessToken({
			aud: Array.isArray(audience) ? audience[0] : audience,
			exp: now + ACCESS_TOKEN_TTL,
			iat: now,
			iss: ISSUER,
			jti: crypto.randomUUID(),
			sub: subjectId,
		});
	}

	static get ttl() {
		return ACCESS_TOKEN_TTL;
	}
}
```

The wrapper class stores the JWT payload and provides typed getters for each claim. The `assertString` and `assertNumber` helper methods validate claim types at runtime, throwing an error if the claim is missing or has the wrong type. For deeper coverage of [validating time-based claims like exp, iat, and nbf](/tutorials/validate-exp-iat-and-nbf-in-jwts), see the dedicated tutorial.

This gives you consistent return types: `id` always returns a string, `issuedAt` always returns a `Date`, and so on. The `toPayload` method exposes the raw payload for signing.

## Add a Static Factory Method

The `generate` static method creates new tokens with all required claims. This factory method encapsulates token creation logic. The caller only needs to provide the audience and subject, while the method handles setting the issuer, generating a unique ID, and calculating expiration. Constants like `ACCESS_TOKEN_TTL` and `ISSUER` come from a central config file, ensuring consistency across your application.

Note that JWT timestamps use seconds since epoch, not milliseconds, so we divide `Date.now()` by 1000. Understanding these [access token claims](/articles/oauth2-access-token-claims-explained) is essential for building secure token handling.

## Create an ID Token Class with Custom Claims

[ID tokens](/articles/oauth2-tokens-explained) in OpenID Connect include user profile information. Create a separate class with [additional claim accessors](/tutorials/add-custom-claims-to-jwt-access-tokens):

```ts {% path="app/entities/id-token.ts" %}
import * as jose from "jose";

import { ID_TOKEN_TTL, ISSUER } from "./config";

interface IdTokenPayload extends jose.JWTPayload {
	sub: string;
	aud: string;
	jti: string;
	exp: number;
	iat: number;
	iss: string;
	email: string;
	picture: string;
	preferred_username: string;
	name: string;
	email_verified: boolean;
}

export default class IdToken {
	constructor(private payload: IdTokenPayload) {}

	get subject(): string {
		return this.assertString(this.payload.sub, "sub");
	}

	get audience(): string {
		return this.assertString(this.payload.aud, "aud");
	}

	get name(): string {
		return this.assertString(this.payload.name, "name");
	}

	get email(): string {
		return this.assertString(this.payload.email, "email");
	}

	get picture(): string {
		return this.assertString(this.payload.picture, "picture");
	}

	get username(): string {
		return this.assertString(this.payload.preferred_username, "preferred_username");
	}

	get emailVerified(): boolean {
		return this.assertBoolean(this.payload.email_verified, "email_verified");
	}

	toPayload(): IdTokenPayload {
		return this.payload;
	}

	private assertString(value: unknown, claim: string): string {
		if (typeof value !== "string") {
			throw new Error(`Expected ${claim} to be a string`);
		}
		return value;
	}

	private assertBoolean(value: unknown, claim: string): boolean {
		if (typeof value !== "boolean") {
			throw new Error(`Expected ${claim} to be a boolean`);
		}
		return value;
	}

	static generate(
		subject: {
			id: string;
			email: string;
			avatar: string;
			username: string;
			displayName: string;
			emailVerified: boolean;
		},
		client: { id: string },
	) {
		let now = Math.floor(Date.now() / 1000);
		return new IdToken({
			sub: subject.id,
			iss: ISSUER,
			aud: client.id,
			jti: crypto.randomUUID(),
			exp: now + ID_TOKEN_TTL,
			iat: now,
			email: subject.email,
			picture: subject.avatar,
			preferred_username: subject.username,
			name: subject.displayName,
			email_verified: subject.emailVerified,
		});
	}
}
```

The `IdToken` class adds custom getters for OIDC standard claims like `name`, `email`, `picture`, and `preferred_username`. Notice how `username` maps to the `preferred_username` claim: the getter provides a cleaner API while the underlying claim follows the OIDC specification.

The `emailVerified` getter uses `assertBoolean()` instead of `assertString()`, demonstrating how the helper methods handle different claim types.

## Use the Wrapper Classes

With these classes in place, working with tokens becomes straightforward:

```ts {% path="app/routes/userinfo.ts" %}
import IdToken from "../entities/id-token";

export async function loader({ request }: Route.LoaderArgs) {
	let payload = await getIdTokenPayloadFromRequest(request);
	let idToken = new IdToken(payload);

	return {
		sub: idToken.subject,
		name: idToken.name,
		email: idToken.email,
		picture: idToken.picture,
		preferred_username: idToken.username,
		email_verified: idToken.emailVerified,
	};
}
```

When you access `idToken.email`, TypeScript knows it returns a string. If the claim is missing or malformed, the parser throws an error immediately rather than letting `undefined` propagate through your code.

## Generate Tokens in Your Auth Flow

Use the factory methods when issuing tokens:

```ts {% path="app/services/token.ts" %}
import * as jose from "jose";

import AccessToken from "../entities/access-token";
import IdToken from "../entities/id-token";
import { getSigningKey } from "../modules/jwks";

export async function issueTokens(user: User, client: Client) {
	let accessToken = AccessToken.generate(client.id, user.id);
	let idToken = IdToken.generate(
		{
			id: user.id,
			email: user.email,
			avatar: user.avatar,
			username: user.username,
			displayName: user.displayName,
			emailVerified: user.emailVerified,
		},
		{ id: client.id },
	);

	let key = await getSigningKey();

	return {
		access_token: await new jose.SignJWT(accessToken.toPayload())
			.setProtectedHeader({ alg: "ES256" })
			.sign(key),
		id_token: await new jose.SignJWT(idToken.toPayload())
			.setProtectedHeader({ alg: "ES256" })
			.sign(key),
		token_type: "Bearer",
		expires_in: AccessToken.ttl,
	};
}
```

The factory methods ensure all required claims are present and correctly typed. TypeScript will error if you forget to pass required fields or pass the wrong types.

## Final Thoughts

JWT wrapper classes provide a clean abstraction over raw token payloads. You get compile time safety from TypeScript knowing the exact shape of each token type, runtime validation from the assertion methods that throw on invalid claims, and a consistent API that maps specification claim names to developer friendly property names. This pattern works well for any application that issues or consumes multiple token types, from [OAuth servers](/tutorials/build-an-oauth2-oidc-provider-from-scratch) to API clients.

When consuming tokens from external providers, combine these wrapper classes with [JWKS validation](/tutorials/validate-jwts-with-jwks) to verify signatures before accessing claims.
