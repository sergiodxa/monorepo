---
title: How to Make Geo-Located Requests with Durable Objects
excerpt: Use Durable Object location hints to send monitoring requests from specific regions.
tech: @cloudflare/workers-types@4.0.0
---

A site can be reachable from North America and broken from Europe. Regional outages, DNS propagation, and upstream routing issues mean latency and availability are not universal. If you are building uptime monitoring, you need requests that originate from more than one region.

Durable Objects support location hints. A hint tells Cloudflare where you would like a Durable Object instance to be created. That makes a Durable Object a useful regional fetcher: create one object per region, call it from your Worker, and let the object make the outbound request.

## Create the Durable Object

Use a Durable Object RPC method instead of a `fetch()` handler. The public method runs inside the Durable Object instance, so the outbound `fetch()` starts from wherever that object is placed.

```ts {% path="app/durable-objects/geo-fetch.ts" %}
import { DurableObject } from "cloudflare:workers";

export interface Env {
	GEO_FETCH: DurableObjectNamespace<GeoFetch>;
}

export interface PingResult {
	status: number;
	responseTimeMs: number;
}

export class GeoFetch extends DurableObject<Env> {
	async ping(url: string): Promise<PingResult> {
		let start = performance.now();
		let response = await fetch(url, { method: "HEAD" });
		let end = performance.now();

		return {
			status: response.status,
			responseTimeMs: end - start,
		};
	}
}
```

This object does not need storage. It exists to pin outbound requests to a Durable Object instance. If you later store check history in the object, write it to Durable Object storage before caching anything in memory.

## Configure the Binding

Bind the Durable Object class in `wrangler.jsonc`. Use a SQLite migration for new Durable Object classes.

```jsonc {% path="wrangler.jsonc" %}
{
	"durable_objects": {
		"bindings": [{ "name": "GEO_FETCH", "class_name": "GeoFetch" }],
	},

	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["GeoFetch"] }],
}
```

The binding gives your Worker access to the `GEO_FETCH` namespace. The migration tells Cloudflare this Worker owns the Durable Object class.

## Export the Class

Durable Object classes must be exported from the Worker entry point so Cloudflare can instantiate them.

```ts {% path="worker.ts" %}
export { GeoFetch } from "./app/durable-objects/geo-fetch";
```

## Choose a Region

Define the location hints your monitoring system supports. Cloudflare treats hints as placement preferences, not hard guarantees.

```ts {% path="app/geo/location-hints.ts" %}
export type LocationHint =
	| "wnam"
	| "enam"
	| "sam"
	| "weur"
	| "eeur"
	| "apac"
	| "apac-ne"
	| "apac-se"
	| "oc"
	| "afr"
	| "me";

export function isEuropeanLocation(locationHint: LocationHint) {
	return locationHint === "weur" || locationHint === "eeur";
}
```

The narrower `apac-ne` and `apac-se` hints are useful when you care about Northeast or Southeast Asia specifically. Use `apac` when you only need a broad Asia-Pacific check.

## Fetch Through the Regional Object

Create one deterministic Durable Object per location hint. Apply the EU jurisdiction before creating the ID, otherwise the ID and namespace can disagree about jurisdiction.

```ts {% path="app/geo/ping-from-region.ts" %}
import { env } from "cloudflare:workers";

import { isEuropeanLocation, type LocationHint } from "./location-hints";

export async function pingFromRegion(url: string, locationHint: LocationHint) {
	let namespace = isEuropeanLocation(locationHint)
		? env.GEO_FETCH.jurisdiction("eu")
		: env.GEO_FETCH;

	let id = namespace.idFromName(locationHint);
	let stub = namespace.get(id, { locationHint });

	return await stub.ping(url);
}
```

`idFromName(locationHint)` makes routing deterministic: every Western Europe check uses the same Western Europe object ID. The `locationHint` option on `get()` is only considered when the object is created for the first time.

The EU jurisdiction is different from a location hint. `jurisdiction("eu")` restricts where the Durable Object runs and stores data. A location hint only asks Cloudflare to place the object near a region.

## Use It from a Workflow

For uptime monitoring, the regional request often belongs inside a Workflow step. That gives you durable progress if the workflow is interrupted.

```ts {% path="app/workflows/monitor.ts" %}
import { WorkflowEntrypoint } from "cloudflare:workers";

import { pingFromRegion } from "../geo/ping-from-region";
import type { LocationHint } from "../geo/location-hints";

interface MonitorPayload {
	monitorId: string;
	url: string;
	locationHint: LocationHint;
}

export class MonitorWorkflow extends WorkflowEntrypoint<Cloudflare.Env, MonitorPayload> {
	async run(event: WorkflowEvent<MonitorPayload>, step: WorkflowStep) {
		let { monitorId, url, locationHint } = event.payload;

		let result = await step.do("ping monitor", async () => {
			return await pingFromRegion(url, locationHint);
		});

		await step.do("store result", async () => {
			await saveMonitorResult({ monitorId, locationHint, result });
		});
	}
}
```

Keep the `ping monitor` step focused on the external request. Store the result in a separate step so retries and observability stay easier to reason about.

## Understand the Limits

Location hints are best effort. Cloudflare tries to place the Durable Object near the hinted region, but it may choose another nearby region if the exact one is unavailable. Durable Objects also do not move after creation, so changing the hint later does not relocate an existing object.

Some hints are broader than others. For example, `apac` covers Asia-Pacific, while `apac-ne` and `apac-se` target narrower subregions. Some hinted regions may currently spawn in a nearby supported region instead of the named region.

Use this pattern when you need consistent regional vantage points for monitoring. Do not use one global Durable Object for every check. One object per region keeps the design simple and avoids turning one instance into a bottleneck.
