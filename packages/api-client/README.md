# @pkg/api-client

Base class for clients of a remote HTTP API.

## Overview

Talking to one HTTP service from several places tends to produce the same three lines
over and over: join a path onto an origin, attach the credential, check the status. Spread
across a module of loose functions, the origin gets repeated, the auth header gets
forgotten in the one call added last, and there is nowhere to put a change that should
apply to every request.

`APIClient` is the small amount of structure that fixes that. A subclass names the origin
once, calls `get`/`post`/`put`/`patch`/`delete` with paths, and — if every request needs
something — overrides `before` to add it in one place. `after` is the mirror image, for
inspecting or replacing a response before the caller sees it.

The class deliberately has one extension mechanism rather than two: hooks are methods you
override, not listeners you register. Nothing here wraps `fetch` in configuration either —
requests go to the global `fetch`, so tests intercept them with MSW like any other
outbound call.

## Usage

### A Client For One Service

```typescript
import { APIClient } from "@pkg/api-client";

class GitHub extends APIClient {
	constructor(private token: string) {
		super(new URL("https://api.github.com"));
	}

	async repository(owner: string, name: string): Promise<Response> {
		return await this.get(`/repos/${owner}/${name}`);
	}
}
```

### Attach What Every Request Needs

`before` runs on each request, whichever verb produced it, so a credential is set once
rather than at every call site.

```typescript
class GitHub extends APIClient {
	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Bearer ${this.token}`);
		request.headers.set("Accept", "application/vnd.github+json");
		return request;
	}
}
```

### Inspect Or Replace A Response

`after` receives the request alongside the response, since what a status means usually
depends on what was asked for.

```typescript
class GitHub extends APIClient {
	protected override async after(request: Request, response: Response): Promise<Response> {
		if (response.status === 404) return Response.json({ items: [] });
		return response;
	}
}
```

### Paths Resolve Against The Base URL

Paths are resolved with `URL`, so a leading slash is anchored at the origin and a relative
path is resolved against the base URL's own path.

```typescript
let client = new APIClient(new URL("https://api.example.com/v1/"));

await client.get("/subjects"); // https://api.example.com/subjects
await client.get("subjects"); // https://api.example.com/v1/subjects
```
