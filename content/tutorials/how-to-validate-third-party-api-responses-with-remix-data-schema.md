---
title: How to Validate Third-Party API Responses with `remix/data-schema`
excerpt: Validate remote JSON with `parseSafe` before third-party data reaches your Remix route modules.
tech: remix@3.0.0-beta.4
---

Third-party APIs are a trust boundary. The request may succeed, but the JSON can still be incomplete, renamed, or shaped differently than your route module expects. If that data reaches your UI without checks, you usually find out with a runtime error in render.

`remix/data-schema` lets you stop that earlier. Define the schema once, infer TypeScript interfaces from it, fetch the remote JSON, and validate it with `parseSafe` before rendering. These APIs ship in the Remix 3 beta, so some details may still change.

## Define the Response Schemas

Start by defining the response shapes you expect from the remote API. Keeping these schemas close to the data layer keeps runtime validation and TypeScript types in sync.

```ts {% path="app/data/jsonplaceholder.ts" %}
import type { InferOutput } from "remix/data-schema";

import * as s from "remix/data-schema";

export const AlbumSchema = s.object({
	userId: s.number(),
	id: s.number(),
	title: s.string(),
});

export const PhotoSchema = s.object({
	albumId: s.number(),
	id: s.number(),
	title: s.string(),
	url: s.string(),
	thumbnailUrl: s.string(),
});

export const AlbumListSchema = s.array(AlbumSchema);

export const PhotoListSchema = s.array(PhotoSchema);

export interface Album extends InferOutput<typeof AlbumSchema> {}

export interface Photo extends InferOutput<typeof PhotoSchema> {}
```

`InferOutput` gives you the validated output type from each schema. That means `Album` and `Photo` now describe what your app actually renders, not what you hope the API returns.

The array schemas matter too. Most third-party APIs return lists and single records, so validating both shapes keeps your data layer consistent.

## Fetch and Validate the Album List

The data module can fetch JSON and validate it before returning. `parseSafe` matters here because bad upstream data is a normal failure case, not an exception in your app logic.

```ts {% path="app/data/jsonplaceholder.server.ts" %}
import * as s from "remix/data-schema";

import type { Album } from "./jsonplaceholder";

import { AlbumListSchema } from "./jsonplaceholder";

const API_ORIGIN = "https://jsonplaceholder.typicode.com";

export async function getAlbums(signal?: AbortSignal): Promise<Album[]> {
	let url = new URL("/albums", API_ORIGIN);
	url.searchParams.set("_limit", "12");

	let payload = await fetchJSON(url, signal);
	let result = s.parseSafe(AlbumListSchema, payload);

	if (!result.success) {
		throw new Response("Albums response did not match the expected schema.", {
			status: 502,
		});
	}

	return result.value;
}

async function fetchJSON(url: URL, signal?: AbortSignal): Promise<unknown> {
	let response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Response("Could not load albums.", { status: response.status });
	}

	return await response.json();
}
```

`fetchJSON` returns `unknown`, which is exactly what remote JSON should be until validation finishes. After `parseSafe` succeeds, `result.value` becomes `Album[]` and the rest of your app can trust it.

Throwing HTTP 502 (Bad Gateway) makes sense here. Your app is fine, but the upstream service returned data that did not match what you expected.

## Render Only Validated Data

Once the data layer validates the response, the controller can render typed data directly. The request signal still matters here because the fetch helpers can stop work if the user leaves the page while the request is in flight.

```tsx {% path="app/router.ts" %}
import type { RemixNode } from "remix/ui";

import { renderWith } from "remix/render-middleware";
import { createController, createRouter } from "remix/router";
import { route } from "remix/routes";
import { renderToString } from "remix/ui/server";

import type { Album } from "./data/jsonplaceholder";

import { getAlbums } from "./data/jsonplaceholder.server";

let routes = route({
	home: "/",
	album: "/albums/:albumId",
});

export let router = createRouter({
	middleware: [renderWith(createHtmlRenderer)],
});

function createHtmlRenderer() {
	return function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return new Response(renderToString(node), { ...init, headers });
	};
}

function AlbumsPage(props: { albums: Album[] }) {
	return () => (
		<main>
			<h1>Albums</h1>
			<ul>
				{props.albums.map((album) => (
					<li key={album.id}>
						<a href={routes.album.href({ albumId: String(album.id) })}>{album.title}</a>
					</li>
				))}
			</ul>
		</main>
	);
}

let controller = createController(routes, {
	actions: {
		async home(ctx) {
			let albums = await getAlbums(ctx.request.signal);
			return ctx.render(<AlbumsPage albums={albums} />);
		},
	},
});

router.map(routes, controller);
```

This controller does not need extra checks for `album.title` or `album.id`. Those values already passed runtime validation, and TypeScript knows their exact shape.

That is the main benefit of this pattern. The uncertainty stays at the fetch boundary instead of leaking into rendering.

## Add Detail and Nested Collection Validation

Most apps need more than one endpoint. You can reuse the same pattern for single records and related collections without changing the controller code very much.

```ts {% path="app/data/jsonplaceholder.server.ts" %}
import * as s from "remix/data-schema";

import type { Album, Photo } from "./jsonplaceholder";

import { AlbumListSchema, AlbumSchema, PhotoListSchema } from "./jsonplaceholder";

const API_ORIGIN = "https://jsonplaceholder.typicode.com";

export async function getAlbums(signal?: AbortSignal): Promise<Album[]> {
	let url = new URL("/albums", API_ORIGIN);
	url.searchParams.set("_limit", "12");

	let payload = await fetchJSON(url, signal);
	let result = s.parseSafe(AlbumListSchema, payload);

	if (!result.success) {
		throw new Response("Albums response did not match the expected schema.", {
			status: 502,
		});
	}

	return result.value;
}

export async function getAlbum(albumId: string, signal?: AbortSignal): Promise<Album> {
	let payload = await fetchJSON(new URL(`/albums/${albumId}`, API_ORIGIN), signal);
	let result = s.parseSafe(AlbumSchema, payload);

	if (!result.success) {
		throw new Response("Album response did not match the expected schema.", {
			status: 502,
		});
	}

	return result.value;
}

export async function getAlbumPhotos(albumId: string, signal?: AbortSignal): Promise<Photo[]> {
	let url = new URL("/photos", API_ORIGIN);
	url.searchParams.set("albumId", albumId);

	let payload = await fetchJSON(url, signal);
	let result = s.parseSafe(PhotoListSchema, payload);

	if (!result.success) {
		throw new Response("Photos response did not match the expected schema.", {
			status: 502,
		});
	}

	return result.value;
}

async function fetchJSON(url: URL, signal?: AbortSignal): Promise<unknown> {
	let response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Response("Could not load JSONPlaceholder data.", {
			status: response.status,
		});
	}

	return await response.json();
}
```

This keeps validation close to each endpoint. If the `/albums/:id` response changes, only `getAlbum` fails. If `/photos` changes, only `getAlbumPhotos` fails.

That separation is useful when one third-party API has several endpoints maintained by different teams or released at different times.

## Load the Detail Route with Trusted Data

The detail controller can now run two validated fetches and render them directly. `Promise.all` keeps the route fast while still validating both requests.

```tsx {% path="app/router.ts" %}
import type { Album, Photo } from "./data/jsonplaceholder";

import { getAlbum, getAlbumPhotos } from "./data/jsonplaceholder.server";

// ... previous code

function AlbumPage(props: { album: Album; photos: Photo[] }) {
	return () => (
		<main>
			<h1>{props.album.title}</h1>
			<ul>
				{props.photos.map((photo) => (
					<li key={photo.id}>
						<img src={photo.thumbnailUrl} alt={photo.title} />
						<p>{photo.title}</p>
					</li>
				))}
			</ul>
		</main>
	);
}

let controller = createController(routes, {
	actions: {
		async home(ctx) {
			let albums = await getAlbums(ctx.request.signal);
			return ctx.render(<AlbumsPage albums={albums} />);
		},

		async album(ctx) {
			let albumId = ctx.params.albumId;

			let [album, photos] = await Promise.all([
				getAlbum(albumId, ctx.request.signal),
				getAlbumPhotos(albumId, ctx.request.signal),
			]);

			return ctx.render(<AlbumPage album={album} photos={photos} />);
		},
	},
});
```

At this point, both controller actions only deal with trusted data. The unsafe part of the system is the fetch boundary, and `parseSafe` handles that before the UI renders.

If validation fails, the controller throws before rendering. That gives you one clear failure path instead of partial UI corruption or a late crash inside the UI tree.

## Final Thoughts

`remix/data-schema` works well for third-party APIs because it gives you one contract for runtime validation and TypeScript inference. `parseSafe` keeps bad upstream data at the edge, which makes the rest of the controller code easier to read and trust.

You can extend this pattern further by adding custom error boundaries, reusing schemas across controllers and actions, or validating search params and `FormData` with the same package.
