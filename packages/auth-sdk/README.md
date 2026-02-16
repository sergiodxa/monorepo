# @pkg/auth-sdk

SDK client for interacting with the auth.sergiodxa.com OAuth server.

## Overview

This package provides an OAuth client SDK for authenticating with auth.sergiodxa.com. It handles client credentials authentication and subject (user) data retrieval with a type-safe API.

Key technologies:

- **@edgefirst-dev/api-client** - HTTP client foundation
- **jose** - JWT encoding for authorization headers
- **@pkg/result** - Result pattern for type-safe error handling

## Usage

```ts
import { AuthSDK } from "@pkg/auth-sdk";

let auth = new AuthSDK({
	client: {
		id: "your-client-id",
		secret: "your-client-secret",
	},
});
```

### Authenticate (Client Credentials)

Request an access token using the client credentials grant:

```ts
import { isFailure } from "@pkg/result";

let result = await auth.authenticate("resource:read", "resource:write");

if (isFailure(result)) {
	console.error(result.error.code, result.error.message);
} else {
	let token = result.data;
}
```

The method accepts optional resource scopes as arguments and returns a `Result<string, AuthenticationError>`.

### Fetch Subject by ID

Retrieve a subject's profile information:

```ts
import { isSuccess, isFailure } from "@pkg/result";

let result = await auth.fetchSubjectById(subjectId, token);

if (isSuccess(result)) {
	console.log(result.data);
	// {
	//   id: string,
	//   createdAt: Date,
	//   updatedAt: Date,
	//   displayName: string,
	//   avatar: string,
	//   role: "user" | "admin",
	//   username: string,
	//   emailAddress: string,
	// }
}

if (isFailure(result)) {
	console.error(result.error.subjectId);
}
```

Returns a `Result<Subject, SubjectNotFoundError>`.

## API Reference

### `Subject` Interface

Represents a user profile returned from the auth server.

| Property       | Type                | Description                |
| -------------- | ------------------- | -------------------------- |
| `id`           | `string`            | Unique identifier (UUID)   |
| `createdAt`    | `Date`              | Account creation timestamp |
| `updatedAt`    | `Date`              | Last update timestamp      |
| `displayName`  | `string`            | User's display name        |
| `avatar`       | `string`            | URL to user's avatar image |
| `role`         | `"user" \| "admin"` | User's role in the system  |
| `username`     | `string`            | Unique username            |
| `emailAddress` | `string`            | User's email address       |

### `AuthSDKOptions` Interface

Configuration options for initializing the SDK.

| Property        | Type     | Description         |
| --------------- | -------- | ------------------- |
| `client.id`     | `string` | OAuth client ID     |
| `client.secret` | `string` | OAuth client secret |

## Error Types

### AuthenticationError

Thrown when authentication fails.

```ts
import { AuthenticationError } from "@pkg/auth-sdk";

// Properties:
// - message: string - Error description
// - code: string - OAuth error code (e.g., "invalid_client")
```

### SubjectNotFoundError

Thrown when a subject cannot be found.

```ts
import { SubjectNotFoundError } from "@pkg/auth-sdk";

// Properties:
// - message: string - Error message
// - subjectId: string - The ID that was not found
```

## Tips

1. **Store client credentials securely** - Keep `client.id` and `client.secret` in environment variables, never commit them to source control
2. **Cache tokens** - Avoid repeated authentication calls by caching access tokens until they expire
3. **Handle token expiration** - Implement token refresh logic to re-authenticate when tokens expire

## Related Packages

- [`@pkg/result`](../result) - Result type used for error handling
