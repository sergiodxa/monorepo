# @sdxc/api-client

Base class for clients of a remote HTTP API: one origin, path-relative verb methods, and
one place to attach what every call needs.

Talking to the same HTTP service from several places repeats the same three lines: join a
path onto an origin, attach the credential, check the status. `APIClient` gives them one
home. A subclass names the origin once, calls `get`/`post`/`put`/`patch`/`delete` with
paths, and overrides `before` and `after` to shape every request and response it makes.

## Installation

```bash
npm add @sdxc/api-client
```

## Usage

### A Client For One Service

```typescript
import { APIClient } from "@sdxc/api-client";

class GitHub extends APIClient {
	constructor(private token: string) {
		super(new URL("https://api.github.com"));
	}

	async repository(owner: string, name: string): Promise<Response> {
		return await this.get(`/repos/${owner}/${name}`);
	}
}

let github = new GitHub("ghp_example");
let response = await github.repository("example-org", "example-repo");
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
class Search extends APIClient {
	protected override async after(request: Request, response: Response): Promise<Response> {
		if (response.status === 404) return Response.json({ items: [] });
		return response;
	}
}
```

### Paths Resolve Against The Base URL

Paths are resolved with
[`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL), so a leading slash is
anchored at the origin and a relative path continues the base URL's own path.

```typescript
let client = new APIClient(new URL("https://api.example.com/v1/"));

await client.get("/subjects"); // https://api.example.com/subjects
await client.get("subjects"); // https://api.example.com/v1/subjects
```

## API

### `new APIClient(baseURL: URL)`

A client bound to one origin. `baseURL` is a `URL` because every path is resolved against
it. Subclass it to give a service its own methods.

### `client.fetch(path: string, init?: RequestInit): Promise<Response>`

Sends one request to `path`, resolved against the base URL, and returns the response after
`after` has seen it. Takes a full `RequestInit`, including `method`, and is what every verb
method calls.

### `client.get(path, init?)`, `client.post(path, init?)`, `client.put(path, init?)`, `client.patch(path, init?)`, `client.delete(path, init?)`

Send a request with that method. Each takes an `APIClientInit` and sets `method` itself:
`client.post("/subjects", { body })` is `client.fetch("/subjects", { body, method: "POST" })`.

### `protected before(request: Request): Promise<Request>`

Adjusts a request before it is sent, and returns the one to send. The single place a
subclass sets what every call carries — credentials, tracing headers, a rewritten body. The
base implementation returns the request as it arrived.

### `protected after(request: Request, response: Response): Promise<Response>`

Sees the response before it reaches the caller, and returns the one to hand back. It
receives the request too, since reading a status usually needs to know what was asked. The
base implementation returns the response as it arrived.

### `protected baseURL: URL`

The origin this instance resolves paths against, readable from a subclass.

### Types

#### `APIClientInit`

The options a verb method accepts: a `RequestInit` minus `method`, which the verb sets.

```typescript
type APIClientInit = Omit<RequestInit, "method">;
```

## Pattern: Methods That Return Data

A client is most useful when its methods return the shape a caller wants rather than a
`Response`. Parsing lives in the method, so the origin, the path and the type stay in one
place:

```typescript
import { APIClient } from "@sdxc/api-client";

interface Subject {
	id: string;
	name: string;
}

class Catalog extends APIClient {
	constructor() {
		super(new URL("https://api.example.com/v1/"));
	}

	async list(): Promise<Subject[]> {
		let response = await this.get("subjects");
		return (await response.json()) as Subject[];
	}

	async create(name: string): Promise<Subject> {
		let response = await this.post("subjects", {
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name }),
		});

		return (await response.json()) as Subject;
	}
}
```

## Pattern: One Error Policy For Every Call

An error status reaches the caller as an ordinary `Response`, so a client that prefers
exceptions states that once in `after` and every method inherits it:

```typescript
import { APIClient } from "@sdxc/api-client";

class CatalogError extends Error {
	constructor(
		readonly status: number,
		readonly url: string,
	) {
		super(`${status} from ${url}`);
		this.name = "CatalogError";
	}
}

class Catalog extends APIClient {
	protected override async after(request: Request, response: Response): Promise<Response> {
		if (response.ok) return response;
		throw new CatalogError(response.status, request.url);
	}
}
```

Reading the body inside `after` calls for a `response.clone()` first, so the caller still
receives an unread stream.

## Pattern: Stubbing The Origin In Tests

Requests go to the global `fetch`, so a test intercepts them the way it intercepts any
other outbound call — with [MSW](https://mswjs.io), for example — and the client under test
is the real one:

```typescript
import { APIClient } from "@sdxc/api-client";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

let server = setupServer(
	http.get("https://api.example.com/subjects", () => {
		return HttpResponse.json([{ id: "1", name: "Tempo" }]);
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("lists subjects", async () => {
	let client = new APIClient(new URL("https://api.example.com"));
	let response = await client.get("/subjects");

	expect(await response.json()).toEqual([{ id: "1", name: "Tempo" }]);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/api-client": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
