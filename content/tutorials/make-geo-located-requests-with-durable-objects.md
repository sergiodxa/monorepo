---
title: How to Make Geo-Located Requests with Durable Objects
excerpt: Use Durable Objects location hints to make HTTP requests from specific geographic regions.
tech: @cloudflare/workers-types@4.0.0
---

A website might be up in North America but down in Europe. Regional outages, CDN issues, or DNS propagation delays can make a site accessible from one location and unreachable from another. This is why [regional monitoring matters](/articles/why-latency-is-not-universal-in-regional-monitoring): latency and availability are not universal. To build reliable uptime monitoring, you need to make requests that actually originate from specific geographic regions.

Cloudflare Durable Objects provide **location hints**: a way to suggest where a Durable Object instance should be created. By routing HTTP requests through a Durable Object with a specific location hint, you can make requests that originate from that region and measure real-world latency from different parts of the world.

## Create the Geo Fetch Durable Object

```ts {% path="app/durable-objects/geo-fetch.ts" %}
import { DurableObject } from "cloudflare:workers";

export class GeoFetchDO extends DurableObject<Cloudflare.Env> {
	override async fetch(request: Request): Promise<Response> {
		let start = performance.now();
		let response = await fetch(request);
		let end = performance.now();

		response = new Response(response.body, response);
		response.headers.set("X-Response-Time", `${end - start}`);

		return response;
	}
}
```

This Durable Object acts as a proxy for HTTP requests. It receives a request, forwards it using `fetch()`, measures the response time, and adds it as a custom header. The key insight is that the `fetch()` call happens from wherever the Durable Object instance is running, which we control with location hints.

## Configure the Durable Object Binding

```jsonc {% path="wrangler.jsonc" %}
{
	"durable_objects": {
		"bindings": [{ "name": "GEO_FETCH", "class_name": "GeoFetchDO" }],
	},

	"migrations": [{ "tag": "v1", "new_classes": ["GeoFetchDO"] }],
}
```

This binds the Durable Object class to the `GEO_FETCH` namespace, making it available in your Worker's environment.

## Export the Durable Object Class

```ts {% path="worker.ts" %}
import { GeoFetchDO } from "./app/durable-objects/geo-fetch";

export { GeoFetchDO };
```

Durable Object classes must be exported from your Worker's entry point for Cloudflare to instantiate them.

## Make Requests from a Specific Region

```ts {% path="app/lib/geo-fetch.ts" %}
import { env } from "cloudflare:workers";

type LocationHint =
	| "wnam" // Western North America
	| "enam" // Eastern North America
	| "sam" // South America
	| "weur" // Western Europe
	| "eeur" // Eastern Europe
	| "apac" // Asia Pacific
	| "oc" // Oceania
	| "afr" // Africa
	| "me"; // Middle East

async function pingFromRegion(url: string, locationHint: LocationHint) {
	// Create a deterministic ID based on the location hint
	let id = env.GEO_FETCH.idFromName(locationHint);

	// Get the stub with the location hint
	let stub = env.GEO_FETCH.get(id, { locationHint });

	// Make the request through the Durable Object
	let response = await stub.fetch(url, { method: "HEAD" });

	return {
		status: response.status,
		responseTimeMs: Number(response.headers.get("X-Response-Time")),
	};
}
```

The `idFromName()` method creates a deterministic ID from a string, so using the location hint as the name means all requests for the same region go to the same Durable Object instance. The `locationHint` option in `get()` tells Cloudflare where to create that instance.

## Handle EU Jurisdiction for GDPR Compliance

```ts {% path="app/lib/geo-fetch.ts" %}
async function pingFromRegion(url: string, locationHint: LocationHint) {
	let id = env.GEO_FETCH.idFromName(locationHint);

	// Use EU jurisdiction for European regions
	let isEurope = locationHint === "eeur" || locationHint === "weur";

	let stub = isEurope
		? env.GEO_FETCH.jurisdiction("eu").get(id, { locationHint })
		: env.GEO_FETCH.get(id, { locationHint });

	let response = await stub.fetch(url, { method: "HEAD" });

	return {
		status: response.status,
		responseTimeMs: Number(response.headers.get("X-Response-Time")),
	};
}
```

For European regions, you can use the `jurisdiction("eu")` method to ensure the Durable Object only runs in EU data centers. This is useful for GDPR compliance when the request or response might contain personal data.

## Use the Geo Fetch in a Workflow

```ts {% path="app/workflows/monitor.ts" %}
import { env, WorkflowEntrypoint } from "cloudflare:workers";

export class MonitorWorkflow extends WorkflowEntrypoint<Cloudflare.Env> {
	async run(event, step) {
		let { monitorId, url, locationHint } = event.payload;

		let result = await step.do("ping monitor", async () => {
			let id = env.GEO_FETCH.idFromName(locationHint);

			let isEurope = locationHint === "eeur" || locationHint === "weur";
			let stub = isEurope
				? env.GEO_FETCH.jurisdiction("eu").get(id, { locationHint })
				: env.GEO_FETCH.get(id, { locationHint });

			let response = await stub.fetch(url, { method: "HEAD" });

			return {
				status: response.status,
				responseTimeMs: Number(response.headers.get("X-Response-Time")),
			};
		});

		// Process the result...
	}
}
```

In a [Cloudflare Workflow](/tutorials/use-cloudflare-workflows-for-long-running-tasks), wrap the geo-located fetch in a `step.do()` call. This makes the operation durable: if the workflow is interrupted, it will resume from the last completed step rather than repeating the request.

## Understand Location Hint Behavior

Location hints are suggestions, not guarantees. Cloudflare will try to create the Durable Object in the requested region, but may choose a nearby region if the requested one is unavailable. Once a Durable Object instance is created, it stays in that location for its lifetime.

The available location hints cover major geographic regions:

- `wnam` and `enam` for North America (west and east)
- `sam` for South America
- `weur` and `eeur` for Europe (west and east)
- `apac` for Asia Pacific
- `oc` for Oceania
- `afr` for Africa
- `me` for Middle East

By using `idFromName(locationHint)`, you create one Durable Object instance per region. All requests for that region route through the same instance, which is efficient for monitoring scenarios where you want consistent measurements from each location.
