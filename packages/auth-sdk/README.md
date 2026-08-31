# @pkg/auth-sdk

Client for the auth service's OAuth token and subject endpoints.

## Overview

A relying party makes two calls against the auth service: exchange its client credentials
for an access token, then read a subject with that token. This package wraps both so
callers work with a `Subject` and a `Result` instead of with response shapes and status
codes.

The origin is fixed at `https://auth.sergiodxa.com`, and the client id and secret are the
only configuration the SDK reads — there is no environment, base URL, or `fetch` option to
pass. Credentials travel as an RFC 7617 Basic authorization header, base64-encoded with
`btoa`; the subject request carries the access token as a Bearer token.

Both responses are validated with [`remix/data-schema`](https://remix.run) before the
caller sees them, so `avatar` is checked as a URL and `createdAt`/`updatedAt` arrive as
`Date` objects transformed from their transport strings.

## Usage

```typescript
import { AuthSDK } from "@pkg/auth-sdk";
import { isFailure, isSuccess } from "@pkg/result";

let auth = new AuthSDK({
	client: { id: env.AUTH_CLIENT_ID, secret: env.AUTH_CLIENT_SECRET },
});

let token = await auth.authenticate("https://api.example.com");
if (isFailure(token)) throw token.error;

let subject = await auth.fetchSubjectById(subjectId, token.data);
if (isSuccess(subject)) console.log(subject.data.displayName, subject.data.createdAt);
```

## API

### `new AuthSDK(options: AuthSDKOptions)`

**Parameters:**

- `options.client.id`: The OAuth client id registered with the auth service
- `options.client.secret`: That client's secret

### `authenticate(...resources: string[]): Promise<Result<string, AuthenticationError>>`

Runs the `client_credentials` grant against `/oauth/token`.

**Parameters:**

- `resources`: Resource indicators to scope the token to, each sent as its own `resource` field

**Returns:**

- A success holding the access token, or a failure holding an `AuthenticationError` built
  from the token endpoint's `error` and `error_description`

**Example:**

```typescript
let result = await auth.authenticate("https://api.example.com", "https://files.example.com");
if (isFailure(result)) console.error(result.error.code, result.error.message);
```

### `fetchSubjectById(subjectId: string, token: string): Promise<Result<Subject, SubjectNotFoundError>>`

Reads a subject from `/api/subjects/:id`.

**Parameters:**

- `subjectId`: The subject to read
- `token`: An access token from `authenticate`

**Returns:**

- A success holding the `Subject`, or a failure holding a `SubjectNotFoundError` carrying
  the requested id

**Example:**

```typescript
let result = await auth.fetchSubjectById(subjectId, token);
if (isSuccess(result)) console.log(result.data.emailAddress);
```

### Types

#### `Subject`

```typescript
interface Subject {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	displayName: string;
	avatar: string;
	role: "user" | "admin";
	username: string;
	emailAddress: string;
}
```

#### `AuthSDKOptions`

```typescript
interface AuthSDKOptions {
	client: { id: string; secret: string };
}
```

#### `AuthenticationError`

Carries the token endpoint's `error` code as `code` and its `error_description` as
`message`.

#### `SubjectNotFoundError`

Carries the requested id as `subjectId`.

## Behavior

1. **Errors come back inside the `Result`** - `AuthenticationError` and
   `SubjectNotFoundError` are returned as failures, so handle them with `isFailure` rather
   than a `try`/`catch`.
2. **Every unsuccessful subject response reads as not-found** - `fetchSubjectById` maps any
   non-ok status to `SubjectNotFoundError`, so a 401 or a 500 arrives as the same failure a
   missing subject produces.
3. **A refused grant is parsed as an RFC 6749 error** - `authenticate` expects the error
   body to hold `error` and `error_description`. A token endpoint answering with a
   different shape makes the method throw the schema's parse error instead of returning a
   failure.
4. **The token is the whole grant response** - only `access_token` is read, so a caller
   that caches the token tracks its own lifetime.

## Related Packages

- [`@pkg/api-client`](/packages/api-client) - The HTTP client base class `AuthSDK` extends
- [`@pkg/result`](/packages/result) - The `Result` type both methods return

## Tips

1. **Keep the credentials in secrets** - `client.id` and `client.secret` authenticate this
   relying party; read them from environment bindings.
2. **Reuse a token across subject reads** - each `authenticate` call is a round trip, and
   the returned token works for every `fetchSubjectById` within its lifetime.
3. **Scope tokens with resource indicators** - pass the APIs a token is meant for so the
   auth service can narrow what it grants.
