---
title: How to Build an OAuth2/OIDC Provider from Scratch
excerpt: Build a complete OAuth2 and OpenID Connect provider with PKCE support using TypeScript.
tech: jose@5.0.0
---

When building a platform with multiple applications, you often need a centralized authentication service. Third party providers like Auth0 or Clerk work well, but sometimes you need full control over the authentication flow: [custom claims](/tutorials/add-custom-claims-to-jwt-access-tokens), specific token lifetimes, or integration with your existing user database. Building your own OAuth2/OIDC provider gives you that control.

The challenge is implementing the OAuth2 specification correctly. You need to handle [authorization codes](/tutorials/store-authorization-codes-with-kv-ttl), [access tokens, refresh tokens](/articles/oauth2-tokens-explained), [PKCE validation](/tutorials/use-pkce-in-oauth2-authorization-code-flow), and the OpenID Connect layer for identity. Getting any of these wrong creates security vulnerabilities. This tutorial walks through building a production ready provider class that handles all of these concerns.

## Define the Repository Interface

Start by defining what data the provider needs access to. The repository pattern abstracts database operations, making the provider testable and database agnostic:

```ts {% path="app/modules/oauth2.ts" %}
import * as jose from "jose";

type Nullable<T> = T | null;

export namespace OAuth2Provider {
	export interface Repository {
		getSigningKey(): Promise<jose.KeyLike>;

		findClientById(clientId: string): Promise<
			Nullable<{
				id: string;
				name: string;
				secret: string;
				logoutUri: string;
				redirectUri: string;
			}>
		>;

		findSessionById(sessionId: string): Promise<
			Nullable<{
				id: string;
				clientId: string;
				subjectId: string;
				expiresAt: Date;
			}>
		>;

		findAuthorizationCodeData(code: string): Promise<{
			clientId: string;
			subjectId: string;
			sessionId: string;
			pkce: { challenge: string; method: "S256" | "plain" } | null;
		}>;

		deleteSessionBySubjectId(subjectId: string): Promise<void>;
		deleteSessionById(sessionId: string): Promise<void>;
	}
}
```

The repository interface defines methods for retrieving signing keys, looking up clients and sessions, and managing authorization codes. Each method returns nullable types where the entity might not exist, forcing you to handle missing data explicitly. The `jose` library provides the `KeyLike` type for cryptographic keys.

## Create the OAuth2 Error Classes

OAuth2 requires specific error codes in responses. Create a base error class and specific error types for each OAuth2 error code. For more advanced patterns on [structuring OAuth2 error hierarchies](/articles/oauth2-error-hierarchies-in-typescript), you can extend this approach with discriminated unions:

```ts {% path="app/errors/oauth2.ts" %}
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

Then create specific error classes for each OAuth2 error type:

```ts {% path="app/errors/invalid-grant.ts" %}
import { OAuth2Error } from "./oauth2";

export class InvalidGrantError extends OAuth2Error {
	override readonly name = "InvalidGrantError";

	constructor(override readonly description: string) {
		super("invalid_grant", description);
	}
}
```

```ts {% path="app/errors/invalid-client.ts" %}
import { OAuth2Error } from "./oauth2";

export class InvalidClientError extends OAuth2Error {
	override readonly name = "InvalidClientError";

	constructor(override readonly description: string) {
		super("invalid_client", description);
	}
}
```

These error classes carry both the OAuth2 error code (like `invalid_grant`) and a human readable description. Your token endpoint can catch these errors and return properly formatted OAuth2 error responses.

## Build the Base OAuth2Provider Class

Create the main provider class that handles token operations:

```ts {% path="app/modules/oauth2.ts" %}
class OAuth2Provider<Repository extends OAuth2Provider.Repository> {
	constructor(
		protected issuer: string,
		protected repository: Repository,
	) {}

	async token(
		args:
			| {
					type: "authorization_code";
					code: string;
					redirectUri: string;
					codeVerifier?: string;
			  }
			| {
					type: "refresh_token";
					refreshToken: string;
			  }
			| {
					type: "client_credentials";
					resource: string[];
					clientId: string;
					clientSecret: string;
			  },
	) {
		if (args.type === "authorization_code") {
			return await this.authorizationCodeGrant(args);
		}

		if (args.type === "refresh_token") {
			return await this.refreshTokenGrant(args);
		}

		if (args.type === "client_credentials") {
			return await this.clientCredentialsGrant(args);
		}

		throw new UnsupportedGrantTypeError("Invalid grant type");
	}

	protected async signJWT(payload: jose.JWTPayload) {
		let key = await this.repository.getSigningKey();
		return await new jose.SignJWT(payload).setProtectedHeader({ alg: "ES256" }).sign(key);
	}
}
```

The `token` method is the entry point for all token requests. It uses a discriminated union to handle different grant types, routing each to its specific implementation. The `signJWT` method uses ES256 (ECDSA with P-256 and SHA-256) for signing, which is the recommended algorithm for OAuth2/OIDC.

## Implement the Authorization Code Grant

The authorization code grant is the most common OAuth2 flow. It exchanges an authorization code for tokens:

```ts {% path="app/modules/oauth2.ts" %}
protected async authorizationCodeGrant(args: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}) {
  let authz = await this.repository.findAuthorizationCodeData(args.code);
  if (!authz) throw new InvalidGrantError("Code has expired or is invalid");

  let { clientId, subjectId, sessionId, pkce } = authz;

  let [client, session] = await Promise.all([
    this.repository.findClientById(clientId),
    this.repository.findSessionById(sessionId),
  ]);

  if (!client) throw new InvalidClientError("Client not found");
  if (!session) throw new InvalidGrantError("Session not found");
  if (isBefore(session.expiresAt, new Date())) {
    throw new InvalidGrantError("Session has expired");
  }

  if (client.redirectUri !== args.redirectUri) {
    throw new InvalidGrantError("Redirect URI mismatch");
  }

  if (pkce) {
    if (!args.codeVerifier) {
      throw new InvalidRequestError("Missing code_verifier");
    }

    if (pkce.method === "S256") {
      let isValid = await CodeChallenge.validate(
        args.codeVerifier,
        pkce.challenge,
        pkce.method
      );

      if (!isValid) throw new InvalidGrantError("PKCE validation failed");
    } else if (pkce.method === "plain") {
      if (args.codeVerifier !== pkce.challenge) {
        throw new InvalidGrantError("PKCE validation failed");
      }
    } else {
      throw new InvalidRequestError("Unsupported PKCE method");
    }
  }

  let accessToken = await this.signJWT(
    AccessToken.generate(clientId, subjectId)
  );

  return {
    access_token: accessToken,
    refresh_token: sessionId,
    expires_in: AccessToken.ttl,
  };
}
```

This method validates the authorization code, checks the client and session exist, verifies the redirect URI matches exactly, and validates PKCE if present. The session ID is used as the refresh token, which ties token refresh to the user's session lifecycle.

## Add PKCE Validation

[PKCE (Proof Key for Code Exchange)](/tutorials/use-pkce-in-oauth2-authorization-code-flow) prevents authorization code interception attacks. Implement the code challenge validation:

```ts {% path="app/modules/oauth2.ts" %}
import { base64url } from "jose";

class CodeChallenge {
	private static async generate(verifier: string, method: "S256" | "plain") {
		if (method === "plain") return verifier;
		let encoder = new TextEncoder();
		let data = encoder.encode(verifier);
		let hash = await crypto.subtle.digest("SHA-256", data);
		return base64url.encode(new Uint8Array(hash));
	}

	static async validate(verifier: string, challenge: string, method: "S256" | "plain" = "S256") {
		let generatedChallenge = await CodeChallenge.generate(verifier, method);
		return generatedChallenge === challenge;
	}
}
```

The S256 method hashes the code verifier with SHA-256 and base64url encodes it. The plain method compares the verifier directly to the challenge. Always prefer S256 in production since plain provides no security benefit.

## Implement the Refresh Token Grant

The refresh token grant issues new access tokens without requiring the user to re-authenticate:

```ts {% path="app/modules/oauth2.ts" %}
protected async refreshTokenGrant(args: { refreshToken: string }) {
  let session = await this.repository.findSessionById(args.refreshToken);
  if (!session) {
    throw new InvalidGrantError("Invalid or expired refresh token");
  }

  let client = await this.repository.findClientById(session.clientId);

  if (!client) throw new InvalidClientError("Client is not registered");

  let accessToken = await this.signJWT(
    AccessToken.generate(session.clientId, session.subjectId)
  );

  return {
    expires_in: AccessToken.ttl,
    access_token: accessToken,
    refresh_token: session.id,
  };
}
```

This method looks up the session by the refresh token, validates the client still exists, and issues a new access token. The same session ID is returned as the refresh token, maintaining the session binding.

## Implement the Client Credentials Grant

The [client credentials grant](/tutorials/use-client_id-and-client_secret-in-oauth2) is for machine to machine authentication where no user is involved:

```ts {% path="app/modules/oauth2.ts" %}
protected async clientCredentialsGrant(args: {
  resource: string[];
  clientId: string;
  clientSecret: string;
}) {
  let client = await this.repository.findClientById(args.clientId);
  if (!client) throw new InvalidClientError("Client is not registered");

  if (client.secret !== args.clientSecret) {
    throw new InvalidClientError("Client is not registered");
  }

  let accessToken = await this.signJWT(
    AccessToken.generate([this.issuer, ...args.resource], args.clientId)
  );

  return { expires_in: AccessToken.ttl, access_token: accessToken };
}
```

This grant validates the client credentials and issues an access token with the requested resources as the [audience](/articles/oauth2-audience-explained). No refresh token is issued since the client can always re-authenticate with its credentials.

## Add Token Revocation

Implement [token revocation](/tutorials/revoke-a-refresh-token-in-oauth2) to allow clients to invalidate refresh tokens:

```ts {% path="app/modules/oauth2.ts" %}
async revoke(args: {
  clientId: string;
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
}) {
  if (args.tokenTypeHint !== "refresh_token") {
    throw new InvalidRequestError("Unsupported token type hint");
  }

  let session = await this.repository.findSessionById(args.token);
  if (!session) {
    throw new InvalidRequestError("Invalid or expired refresh token");
  }

  if (session.clientId !== args.clientId) {
    throw new UnauthorizedClientError();
  }

  await this.repository.deleteSessionById(session.id);
}
```

Revocation deletes the session, which invalidates the refresh token. Access tokens cannot be revoked since they are [self contained JWTs](/articles/jwt-vs-opaque-tokens), but they have short lifetimes.

## Expose the Well-Known Configuration

OAuth2 clients need to discover your provider's endpoints. Expose the configuration through a getter:

```ts {% path="app/modules/oauth2.ts" %}
get wellKnown() {
  return {
    issuer: this.issuer,
    code_challenge_methods_supported: ["S256", "plain"],
    id_token_signing_alg_values_supported: ["ES256"],
    request_parameter_supported: false,
    request_uri_parameter_supported: false,
    response_types_supported: ["code", "token"],
    scopes_supported: [] as string[],
  };
}

async getJwks() {
  let key = await this.repository.getSigningKey();
  return jose.exportJWK(key);
}
```

The `wellKnown` property returns the OAuth2 discovery document. The `getJwks` method returns the JSON Web Key Set that clients use to [verify token signatures](/tutorials/validate-jwts-with-jwks).

## Extend to OpenID Connect

OIDC adds an identity layer on top of OAuth2. Extend the base provider with user info and ID tokens:

```ts {% path="app/modules/oauth2.ts" %}
export namespace OIDCProvider {
	export interface Repository extends OAuth2Provider.Repository {
		findSubjectById(subjectId: string): Promise<
			Nullable<{
				id: string;
				avatar: string;
				username: string;
				displayName: string;
				emailAddress: string;
				emailVerifiedAt: Date | null;
			}>
		>;
	}
}

export class OIDCProvider extends OAuth2Provider<OIDCProvider.Repository> {
	async userinfo(args: { accessToken: string; clientId?: string }) {
		let accessToken = await AccessToken.verify(
			args.accessToken,
			await this.repository.getSigningKey(),
			{ issuer: this.issuer },
		);

		let subject = await this.repository.findSubjectById(accessToken.subject);

		return subject;
	}
}
```

The OIDC provider extends the repository interface to include user lookup. The `userinfo` endpoint verifies the access token and returns the user's profile information.

## Override Grants to Include ID Tokens

OIDC requires ID tokens in the authorization code and refresh token responses:

```ts {% path="app/modules/oauth2.ts" %}
protected override async authorizationCodeGrant(args: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}) {
  let result = await super.authorizationCodeGrant(args);

  let accessToken = AccessToken.decode(result.access_token);

  let subject = await this.repository.findSubjectById(accessToken.subject);
  if (!subject) throw new InvalidGrantError("Subject not found");

  let authz = await this.repository.findAuthorizationCodeData(args.code);
  if (!authz) throw new InvalidGrantError("Code has expired or is invalid");

  let idToken = await this.signJWT(
    IdToken.generate(
      {
        id: subject.id,
        email: subject.emailAddress,
        avatar: subject.avatar,
        username: subject.username,
        displayName: subject.displayName,
        emailVerified: subject.emailVerifiedAt !== null,
      },
      { id: authz.clientId }
    )
  );

  return { ...result, id_token: idToken };
}
```

The override calls the parent implementation to get the access and refresh tokens, then generates an ID token with the user's claims. The ID token includes standard OIDC claims like `email`, `picture`, `preferred_username`, and `name`.

## Implement OIDC Logout

OIDC defines a logout endpoint that invalidates all sessions for a user:

```ts {% path="app/modules/oauth2.ts" %}
async logout(args: {
  idTokenHint: string;
  postLogoutRedirectUri?: string;
  sessionSubject?: string;
}) {
  let key = await this.repository.getSigningKey();
  let { payload: idToken } = await jose.jwtVerify(args.idTokenHint, key, {
    issuer: this.issuer,
    algorithms: ["ES256"],
  });

  if (!idToken.sub) throw new InvalidRequestError("Invalid subject");
  if (!idToken.aud) {
    throw new InvalidRequestError("Invalid audience");
  }
  if (Array.isArray(idToken.aud)) {
    throw new InvalidRequestError("Invalid audience");
  }

  let [client, subject] = await Promise.all([
    this.repository.findClientById(idToken.aud),
    this.repository.findSubjectById(idToken.sub),
  ]);

  if (!subject) throw new InvalidRequestError("Invalid subject");
  if (!client) throw new InvalidRequestError("Invalid audience");

  if (client.redirectUri !== args.postLogoutRedirectUri) {
    throw new InvalidRequestError("Invalid redirect uri");
  }

  if (args.sessionSubject !== subject.id) {
    throw new InvalidRequestError("Invalid session subject");
  }

  await this.repository.deleteSessionBySubjectId(subject.id);

  return { subjectId: subject.id, redirectUri: args.postLogoutRedirectUri };
}
```

The logout endpoint verifies the ID token hint, validates the redirect URI against the client's registered URI, and deletes all sessions for the user. This ensures the user is logged out of all applications that share this provider.

## Final Thoughts

Building an OAuth2/OIDC provider requires careful attention to the specification. The provider pattern shown here separates the protocol logic from data access, making it testable and adaptable to different storage backends. PKCE support is essential for public clients, and the OIDC layer adds standardized identity claims that applications can rely on. For production use, add rate limiting on the token endpoint, implement proper logging for security audits, and consider adding support for additional grant types like device authorization for IoT devices.

For managing the tokens themselves, consider using [type-safe JWT wrapper classes](/tutorials/create-type-safe-jwt-wrapper-classes) to encapsulate token structure and validation.
