---
name: sdxc-api-client
description: "@sdxc/api-client is a base class for clients of a remote HTTP API: one origin, path-relative get/post/put/patch/delete methods, and `before`/`after` hooks every call passes through. Use when writing a typed wrapper around a third-party or internal HTTP service, when the same auth header or error policy is being repeated at every fetch call site, or when a client needs one place to turn error statuses into thrown errors."
---

# @sdxc/api-client

Talking to the same HTTP service from several places repeats the same three lines: join a path onto an origin, attach the credential, check the status. `APIClient` gives them one home. A subclass names the origin once in its constructor, calls `get`/`post`/`put`/`patch`/`delete` with paths resolved against that base `URL`, and overrides the protected `before` and `after` hooks to shape every request and response it makes. It uses the global `fetch`, so it runs on any runtime that has one.

Full API, options and examples: [packages/api-client/README.md](packages/api-client/README.md)

## When to reach for it

- A service is being called from more than one module and the origin, the token and the status check are copy-pasted each time.
- A wrapper should return parsed data rather than a `Response`, with the path and the return type in one place.
- Error statuses should become exceptions (or a fallback response) once, for every method of a client.
- A client needs to be exercised in tests against the real code path, with only the network intercepted.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/api-client": "workspace:*" } }
```

```ts
import { APIClient } from "@sdxc/api-client";

class GitHub extends APIClient {
	constructor(private token: string) {
		super(new URL("https://api.github.com"));
	}

	async repository(owner: string, name: string): Promise<Response> {
		return await this.get(`/repos/${owner}/${name}`);
	}
}
```

## Suggestions

- Put credentials and tracing headers in `before`, and one error policy in `after`; both run for every verb method, so no call site repeats them.
- Paths resolve through `URL`, so a leading slash anchors at the origin and drops the base URL's own path: with a base of `https://api.example.com/v1/`, `get("/subjects")` hits `/subjects` and `get("subjects")` hits `/v1/subjects`.
- Reading the body inside `after` needs a `response.clone()` first, or the caller receives an already-read stream.
- Requests go through the global `fetch`, so tests intercept them with MSW and run the real client.

## Related

- `@sdxc/billing` — its providers reach payment platforms through this base class; skill `sdxc-billing`
