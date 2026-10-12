# @sdxc/api-client

Base class for HTTP API clients: one origin, verb methods, shared hooks.

A client of a remote service is a subclass of `APIClient`: it names the origin once, calls
`get`/`post`/`put`/`patch`/`delete` with paths, and overrides `before` and `after` to shape every
request and response in one place.

## Installation

```sh
npm add @sdxc/api-client
```

Requests carry the running trace through
[`@sdxc/trace-context`](https://www.npmjs.com/package/@sdxc/trace-context), installed with it.

## Usage

### Define a client for one service

```typescript
import { APIClient } from "@sdxc/api-client";

class Catalog extends APIClient {
	constructor() {
		super(new URL("https://api.example.com/v1/"));
	}

	async product(id: string): Promise<Response> {
		return await this.get(`products/${id}`);
	}
}

let catalog = new Catalog();
let response = await catalog.product("42");
```

### Attach what every request needs

`before` runs on every request, whichever verb sent it, so a credential is set once.

```typescript
import { APIClient } from "@sdxc/api-client";

class Catalog extends APIClient {
	constructor(private token: string) {
		super(new URL("https://api.example.com/v1/"));
	}

	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Bearer ${this.token}`);
		return request;
	}
}
```

### Paths resolve against the base URL

Paths are resolved with [`new URL(path, base)`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL):
a leading slash anchors at the origin, and a relative path continues the base URL's own path.

```typescript
import { APIClient } from "@sdxc/api-client";

let client = new APIClient(new URL("https://api.example.com/v1/"));

await client.get("products"); // https://api.example.com/v1/products
await client.get("/products"); // https://api.example.com/products
```

## API

### `new APIClient(baseURL: URL)`

A client bound to one origin. Subclass it to give a service its own methods.

### `client.fetch(path: string, init?: RequestInit): Promise<Response>`

Resolves `path` against the base URL, writes the current trace headers, runs `before`, sends the
request with the global `fetch`, and returns what `after` hands back. Every verb method calls it.

### `client.get`, `client.post`, `client.put`, `client.patch`, `client.delete`

`(path: string, init?: APIClientInit) => Promise<Response>`. Each sets its own `method`, so
`client.post("products", { body })` is `client.fetch("products", { body, method: "POST" })`.

### `protected before(request: Request): Promise<Request>`

Returns the request to send. It sees the trace headers already written, so it can read, replace
or delete them. The default returns the request as it arrived.

### `protected after(request: Request, response: Response): Promise<Response>`

Returns the response to hand to the caller, with the request that produced it. The default
returns the response as it arrived.

### `protected propagateTrace: "all" | "traceparent" | "none"`

Which [W3C Trace Context](https://www.w3.org/TR/trace-context/) headers a request carries when
the running invocation has a trace: `traceparent` and `tracestate` (`"all"`, the default),
`traceparent` alone, or neither. A `traceparent` passed in `init` is kept.

### `protected baseURL: URL`

The origin paths resolve against, readable from a subclass.

### Types

#### `APIClientInit`

`Omit<RequestInit, "method">`: the options a verb method accepts.

## Pattern: Methods That Return Data

Parsing lives in the method, so the path, the payload and the type a caller receives stay
together.

```typescript
import { APIClient } from "@sdxc/api-client";

interface Product {
	id: string;
	name: string;
}

class Catalog extends APIClient {
	constructor() {
		super(new URL("https://api.example.com/v1/"));
	}

	async list(): Promise<Product[]> {
		let response = await this.get("products");
		return (await response.json()) as Product[];
	}

	async create(name: string): Promise<Product> {
		let response = await this.post("products", {
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name }),
		});
		return (await response.json()) as Product;
	}

	async remove(id: string): Promise<boolean> {
		let response = await this.delete(`products/${id}`);
		return response.ok;
	}
}

let catalog = new Catalog();
let product = await catalog.create("Lamp");
await catalog.remove(product.id);
```

## Pattern: One Error Policy For Every Call

An error status reaches the caller as an ordinary `Response`. `after` states the policy once,
with the request at hand: here a missing search answers an empty list, and any other failure
becomes a value the caller checks.

```typescript
import { APIClient } from "@sdxc/api-client";

class Search extends APIClient {
	constructor() {
		super(new URL("https://search.example.com"));
	}

	protected override async after(request: Request, response: Response): Promise<Response> {
		if (response.status === 404 && new URL(request.url).pathname === "/search") {
			return Response.json({ items: [] });
		}
		return response;
	}

	async search(query: string): Promise<{ items: string[] } | { error: number }> {
		let response = await this.get(`/search?q=${encodeURIComponent(query)}`);
		if (!response.ok) return { error: response.status };
		return (await response.json()) as { items: string[] };
	}
}
```

Read the body inside `after` from `response.clone()`, so the caller still receives an unread
stream.

## Pattern: Carry The Trace Across Services

Inside a traced invocation every request names that invocation's span as its parent, so the
callee's logs join the caller's trace. `propagateTrace` narrows what a third party receives.

```typescript
import { APIClient } from "@sdxc/api-client";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

class Inventory extends APIClient {
	constructor() {
		super(new URL("https://inventory.internal.example.com"));
	}
}

class Payments extends APIClient {
	protected override readonly propagateTrace = "traceparent";

	constructor() {
		super(new URL("https://payments.example.com"));
	}
}

let inventory = new Inventory();
let payments = new Payments();

let router = createRouter({ middleware: [trace()] });

router.post("/checkout", async () => {
	await inventory.post("/reservations"); // traceparent and tracestate
	await payments.post("/charges"); // traceparent only
	return new Response(null, { status: 204 });
});
```

Outside a traced invocation the requests carry no trace headers.

## Pattern: Stubbing The Origin In Tests

Requests go through the global `fetch`, so a test intercepts them with
[MSW](https://mswjs.io) and exercises the real client.

```typescript
import { APIClient } from "@sdxc/api-client";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

let server = setupServer(
	http.get("https://api.example.com/products", () => {
		return HttpResponse.json([{ id: "1", name: "Lamp" }]);
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("lists products", async () => {
	let client = new APIClient(new URL("https://api.example.com"));
	let response = await client.get("/products");

	expect(await response.json()).toEqual([{ id: "1", name: "Lamp" }]);
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
