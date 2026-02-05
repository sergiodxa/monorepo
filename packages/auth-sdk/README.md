# @pkg/auth-sdk

SDK client for interacting with the auth.sergiodxa.com OAuth server.

## Installation

```sh
bun add @pkg/auth-sdk
```

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
